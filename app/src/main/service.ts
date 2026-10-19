import { randomUUID } from 'node:crypto'
import { copyFile, constants as fsConstants, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, sep } from 'node:path'
import { BackupFileSystem } from '../vault/backup/backup-fs.js'
import { DEFAULT_MAX_COMPRESSION_RATIO } from '../vault/backup/compression.js'
import { BackupBlockedError, BackupCancelledError, BackupConcurrentChangeError, BackupDecisionError, BackupDestinationError, BackupVerificationError, BackupWriteError } from '../vault/backup/errors.js'
import { exportBackup } from '../vault/backup/export.js'
import { scanVault } from '../vault/backup/inventory.js'
import { restoreBackup } from '../vault/backup/restore.js'
import { verifyBackupArchive } from '../vault/backup/verify-archive.js'
import { sha256 } from '../vault/core/record.js'
import { InboxTransactions } from '../vault/inbox.js'
import { VaultError, VaultRepository, translate } from '../vault/repository.js'
import { markdownLink } from '../domain/links.js'
import type { EntityKind } from '../domain/model.js'
import type { ApiError, AppState, ConversionOutput, ExportOutcome, ExportPreview, Result, RestoreOutcome, RestorePreview, ThemePreference, VaultSnapshot } from '../shared/api.js'

// Preferências do dispositivo (D-014, D-027): fora do vault, na pasta de dados do aplicativo.
interface DeviceSettings {
  vaultPath: string | null
  recentVaults: string[]
  theme: ThemePreference
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail(error: unknown): Result<never> {
  if (error instanceof VaultError) return { ok: false, error: { code: error.code, message: error.message, details: error.details } }
  const e = error as Error
  const known: Array<[new (...args: never[]) => Error, ApiError['code']]> = [
    [BackupBlockedError, 'blocked'], [BackupCancelledError, 'cancelled'], [BackupDecisionError, 'invalid'],
    [BackupConcurrentChangeError, 'conflict'], [BackupVerificationError, 'failed'], [BackupWriteError, 'storage'], [BackupDestinationError, 'invalid']
  ]
  for (const [type, code] of known) {
    if (e instanceof type) {
      const diagnostics = (e as { diagnostics?: Array<{ path: string; message: string }> }).diagnostics
      return { ok: false, error: { code, message: describeBackupError(e), details: diagnostics ? { diagnostics } : {} } }
    }
  }
  return { ok: false, error: translate(error) as unknown as ApiError }
}

function describeBackupError(e: Error): string {
  if (e instanceof BackupBlockedError) return 'O backup foi bloqueado. Corrija os itens listados e tente de novo.'
  if (e instanceof BackupCancelledError) return 'Exportação cancelada; nada foi gravado.'
  if (e instanceof BackupConcurrentChangeError) return 'O vault mudou durante a exportação; nenhum backup foi publicado. Tente de novo.'
  if (e instanceof BackupVerificationError) return 'O arquivo de backup não passou na verificação; nada foi publicado.'
  if (e instanceof BackupWriteError) return `Falha ao gravar o backup (${e.stage}); nada foi publicado.`
  if (e instanceof BackupDestinationError) return e.message
  if (e instanceof BackupDecisionError) return 'O inventário mudou; revise as decisões e tente de novo.'
  return e.message
}

export class AtlasService {
  private settings: DeviceSettings = { vaultPath: null, recentVaults: [], theme: 'system' }
  private repo: VaultRepository | null = null
  private inbox: InboxTransactions | null = null

  constructor(private readonly appDataDirectory: string, private readonly appVersion: string) {}

  private get settingsPath(): string {
    return join(this.appDataDirectory, 'device-settings.json')
  }

  async init(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Partial<DeviceSettings>
      this.settings = {
        vaultPath: typeof raw.vaultPath === 'string' ? raw.vaultPath : null,
        recentVaults: Array.isArray(raw.recentVaults) ? raw.recentVaults.filter((p): p is string => typeof p === 'string').slice(0, 8) : [],
        theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system'
      }
    } catch {
      // Primeira execução ou arquivo ilegível: preferências padrão; o vault em si não é afetado.
    }
    if (this.settings.vaultPath) {
      try {
        await this.activate(this.settings.vaultPath, false)
      } catch {
        this.settings.vaultPath = null
      }
    }
  }

  private async persistSettings(): Promise<void> {
    await mkdir(this.appDataDirectory, { recursive: true })
    const temporary = `${this.settingsPath}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(this.settings, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, this.settingsPath)
  }

  state(): AppState {
    return { vaultPath: this.settings.vaultPath, recentVaults: this.settings.recentVaults, theme: this.settings.theme, version: this.appVersion }
  }

  get vaultRoot(): string | null {
    return this.repo?.root ?? null
  }

  async activate(path: string, create: boolean): Promise<AppState> {
    const root = await realpath(path)
    if (!(await stat(root)).isDirectory()) throw new VaultError('invalid', 'O caminho escolhido não é uma pasta.')
    const repo = new VaultRepository(root)
    if (create) await repo.ensureStructure()
    else {
      const entries = new Set((await readdir(root)).map((n) => n.toLowerCase()))
      const looksLikeVault = ['groups', 'tags', 'items', 'tasks', 'notes', 'inbox'].some((n) => entries.has(n))
      if (!looksLikeVault && entries.size > 0) throw new VaultError('invalid', 'A pasta não parece um vault do Atlas (nenhuma pasta canônica encontrada). Use “Criar vault” numa pasta vazia ou escolha outro local.')
      await repo.ensureStructure()
    }
    this.repo = repo
    this.inbox = new InboxTransactions(repo)
    this.settings.vaultPath = root
    this.settings.recentVaults = [root, ...this.settings.recentVaults.filter((p) => p.toLowerCase() !== root.toLowerCase())].slice(0, 8)
    await this.persistSettings()
    return this.state()
  }

  async closeVault(): Promise<AppState> {
    this.repo = null
    this.inbox = null
    this.settings.vaultPath = null
    await this.persistSettings()
    return this.state()
  }

  async setTheme(theme: ThemePreference): Promise<AppState> {
    this.settings.theme = theme
    await this.persistSettings()
    return this.state()
  }

  private require(): { repo: VaultRepository; inbox: InboxTransactions } {
    if (!this.repo || !this.inbox) throw new VaultError('not-found', 'Nenhum vault aberto.')
    return { repo: this.repo, inbox: this.inbox }
  }

  async load(): Promise<VaultSnapshot> {
    const { repo, inbox } = this.require()
    let report = await repo.load()
    const recovery = report.transactions.length > 0 ? await inbox.recoverAll(report.transactions) : []
    if (recovery.length > 0) report = await repo.load()
    const records = repo.views()
    const schemaVersions = [...new Set(records.map((r) => r.metadata.schema_version as number))].sort()
    return { path: repo.root, records, invalid: report.invalid, temporaries: report.temporaries, transactions: report.transactions, recovery, schemaVersions }
  }

  create(kind: EntityKind, metadata: Record<string, unknown>, body: string) {
    return this.require().repo.create(kind, metadata, body)
  }

  update(id: string, revision: string, metadata: Record<string, unknown>, body?: string) {
    return this.require().repo.update(id, revision, metadata, body)
  }

  refresh(id: string) {
    return this.require().repo.refresh(id)
  }

  convert(captureId: string, revision: string, outputs: ConversionOutput[]) {
    return this.require().inbox.convert(captureId, revision, outputs)
  }

  // Anexo (D-027): cópia exclusiva para assets/{UUID}-{nome saneado}; devolve o link relativo.
  async addAttachment(fromRecordPath: string, sourceFile: string): Promise<{ markdown: string }> {
    const { repo } = this.require()
    const original = basename(sourceFile)
    const extension = extname(original).slice(0, 16)
    const stem = original.slice(0, original.length - extname(original).length)
      .normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'anexo'
    const name = `${randomUUID()}-${stem}${extension.replace(/[<>:"/\\|?*\u0000-\u001F ]/g, '')}`
    const relPath = `assets/${name}`
    await mkdir(repo.abs('assets'), { recursive: true })
    await copyFile(sourceFile, repo.abs(relPath), fsConstants.COPYFILE_EXCL)
    const image = /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
    return { markdown: `${image ? '!' : ''}${markdownLink(fromRecordPath, relPath, original)}` }
  }

  async previewExport(): Promise<ExportPreview> {
    const { repo } = this.require()
    const inventory = await scanVault(repo.root, new BackupFileSystem())
    return {
      canonicalCount: inventory.canonical.length,
      totalBytes: inventory.canonical.reduce((sum, f) => sum + f.size, 0),
      nonCanonical: inventory.nonCanonical.map((f) => f.path),
      systemFiles: inventory.systemFiles.map((f) => f.path),
      blockers: inventory.blocks.map((b) => ({ path: b.path, message: b.message }))
    }
  }

  async runExport(archivePath: string, decisions: { nonCanonical: Record<string, 'include' | 'exclude'>; systemFiles: 'include' | 'exclude' }): Promise<ExportOutcome> {
    const { repo } = this.require()
    const result = await exportBackup(repo.root, archivePath, { decide: () => decisions, maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO })
    return { archivePath: result.archivePath, fileCount: result.manifest.file_count, sha256: sha256(await readFile(result.archivePath)) }
  }

  async previewRestore(archivePath: string): Promise<RestorePreview> {
    const manifest = await verifyBackupArchive(archivePath, { maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO })
    const byFolder: Record<string, number> = {}
    for (const file of manifest.files) {
      const segments = file.path.split('/')
      const area = segments[0] === 'notes' && segments.length > 2 ? `notes/${segments[1]}` : segments.length > 1 ? segments[0]! : 'raiz'
      byFolder[area] = (byFolder[area] ?? 0) + 1
    }
    return { archivePath, createdAt: manifest.created_at, manifestVersion: manifest.manifest_version, fileCount: manifest.file_count, totalBytes: manifest.files.reduce((s, f) => s + f.size, 0), byFolder }
  }

  async runRestore(archivePath: string, parentDirectory: string, folderName: string): Promise<RestoreOutcome> {
    const report = await restoreBackup(archivePath, {
      parentDirectory,
      folderName,
      appDataDirectory: this.appDataDirectory,
      activeVaultRoot: this.repo?.root,
      maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO,
      appVersion: this.appVersion,
      confirm: () => true
    })
    return {
      state: report.state,
      destination: report.destination ?? null,
      canOpen: report.canOpen,
      counts: report.counts,
      messages: [...report.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`), ...report.warnings.map((w) => `Aviso — ${w.path ? `${w.path}: ` : ''}${w.message}`)],
      notice: report.notice
    }
  }

  isInsideVault(path: string): boolean {
    const root = this.repo?.root
    if (!root) return false
    const a = root.toLowerCase()
    const b = path.toLowerCase()
    return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep)
  }
}
