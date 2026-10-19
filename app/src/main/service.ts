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
import { VaultError, VaultRepository, translate, type LoadReport } from '../vault/repository.js'
import { autoBackupName, describeConflict, keepCurrent, rotateAutoBackups, syncProvider, useCopy, type ConflictView, type Trash } from '../vault/sync.js'
import { markdownLink } from '../domain/links.js'
import type { EntityKind } from '../domain/model.js'
import type { ApiError, AppState, AutoBackupSettings, ConversionOutput, ExportOutcome, ExportPreview, Result, RestoreOutcome, RestorePreview, ThemePreference, VaultSnapshot } from '../shared/api.js'

// Preferências do dispositivo (D-014, D-027): fora do vault, na pasta de dados do aplicativo.
interface DeviceSettings {
  vaultPath: string | null
  recentVaults: string[]
  theme: ThemePreference
  // Backup automático (D-031 §5): decisão permanente da pessoa, por dispositivo.
  autoBackup: AutoBackupSettings
}

const DEFAULT_AUTO_BACKUP: AutoBackupSettings = { enabled: false, folder: null, keep: 10, last: null, lastSuccessAt: null }
const DAY_MS = 24 * 60 * 60 * 1000

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
  const t = translate(error)
  // Objeto simples: instâncias de Error perdem campos na serialização do IPC.
  return { ok: false, error: { code: t.code, message: t.message, details: t.details } }
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

function signatureOf(repo: VaultRepository, report: LoadReport): string {
  return [
    ...repo.views().map((v) => `${v.id}:${v.revision}`).sort(),
    ...report.invalid.map((i) => `invalid:${i.path}`).sort(),
    ...report.conflicts.map((c) => `conflict:${c.path}`).sort(),
    ...report.transactions.map((t) => `txn:${t}`).sort()
  ].join('\n')
}

export class AtlasService {
  private settings: DeviceSettings = { vaultPath: null, recentVaults: [], theme: 'system', autoBackup: { ...DEFAULT_AUTO_BACKUP } }
  private repo: VaultRepository | null = null
  private inbox: InboxTransactions | null = null
  // Operações que leem ou gravam o repositório correm em série, para que uma releitura disparada
  // pela sincronização não intercale com uma gravação (D-031).
  private queue: Promise<unknown> = Promise.resolve()
  private converting = new Set<string>()
  private autoBackupRunning = false

  constructor(private readonly appDataDirectory: string, private readonly appVersion: string, private readonly trash: Trash = async () => { throw new Error('Lixeira indisponível') }, private readonly clock: () => Date = () => new Date()) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private get settingsPath(): string {
    return join(this.appDataDirectory, 'device-settings.json')
  }

  async init(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.settingsPath, 'utf8')) as Partial<DeviceSettings>
      this.settings = {
        vaultPath: typeof raw.vaultPath === 'string' ? raw.vaultPath : null,
        recentVaults: Array.isArray(raw.recentVaults) ? raw.recentVaults.filter((p): p is string => typeof p === 'string').slice(0, 8) : [],
        theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
        autoBackup: { ...DEFAULT_AUTO_BACKUP, ...(raw.autoBackup ?? {}) }
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
    return {
      vaultPath: this.settings.vaultPath,
      recentVaults: this.settings.recentVaults,
      theme: this.settings.theme,
      version: this.appVersion,
      autoBackup: this.settings.autoBackup,
      syncProvider: this.repo ? syncProvider(this.repo.root) : null
    }
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

  load(): Promise<VaultSnapshot> {
    return this.serial(async () => {
      const { repo, inbox } = this.require()
      let report = await repo.load()
      // Nunca "recupera" uma conversão que este processo está executando agora.
      const pending = report.transactions.filter((t) => ![...this.converting].some((id) => t.endsWith(`.txn_${id}.json`)))
      const recovery = pending.length > 0 ? await inbox.recoverAll(pending) : []
      if (recovery.length > 0) report = await repo.load()
      const records = repo.views()
      const schemaVersions = [...new Set(records.map((r) => r.metadata.schema_version as number))].sort()
      return { path: repo.root, records, invalid: report.invalid, temporaries: report.temporaries, transactions: report.transactions, recovery, schemaVersions, conflicts: report.conflicts }
    })
  }

  // Assinatura do estado do disco, calculada numa leitura separada (não altera o repositório ativo).
  async diskSignature(): Promise<string | null> {
    if (!this.repo) return null
    const probe = new VaultRepository(this.repo.root)
    return signatureOf(probe, await probe.load())
  }

  // Mesma assinatura a partir do repositório em memória: logo depois de uma operação do próprio app,
  // ela coincide com o disco, e o observador não trata a gravação como mudança externa.
  memorySignature(): string | null {
    return this.repo ? signatureOf(this.repo, this.repo.report()) : null
  }

  create(kind: EntityKind, metadata: Record<string, unknown>, body: string) {
    return this.serial(() => this.require().repo.create(kind, metadata, body))
  }

  update(id: string, revision: string, metadata: Record<string, unknown>, body?: string) {
    return this.serial(() => this.require().repo.update(id, revision, metadata, body))
  }

  refresh(id: string) {
    return this.serial(() => this.require().repo.refresh(id))
  }

  convert(captureId: string, revision: string, outputs: ConversionOutput[]) {
    return this.serial(async () => {
      this.converting.add(captureId)
      try {
        return await this.require().inbox.convert(captureId, revision, outputs)
      } finally {
        this.converting.delete(captureId)
      }
    })
  }

  // Conflitos de sincronização (D-031 §4).
  conflict(path: string): Promise<ConflictView> {
    return this.serial(async () => {
      const { repo } = this.require()
      await repo.load()
      const found = repo.report().conflicts.find((c) => c.path === path)
      if (!found) throw new VaultError('not-found', 'Cópia de conflito não encontrada; releia o vault.')
      return describeConflict(repo, found)
    })
  }

  resolveConflict(path: string, choice: 'keep-current' | 'use-copy', expectedCurrentRevision: string | null): Promise<null> {
    return this.serial(async () => {
      const { repo } = this.require()
      await repo.load()
      if (choice === 'keep-current') await keepCurrent(repo, path, this.trash)
      else await useCopy(repo, path, expectedCurrentRevision, this.trash)
      return null
    })
  }

  // Backup automático (D-031 §5).
  async setAutoBackup(patch: Partial<Pick<AutoBackupSettings, 'enabled' | 'folder' | 'keep'>>): Promise<AppState> {
    const next = { ...this.settings.autoBackup, ...patch }
    if (next.folder && this.isInsideVault(await realpath(next.folder).catch(() => next.folder!))) throw new VaultError('invalid', 'A pasta do backup automático precisa ficar fora do vault.')
    if (!Number.isInteger(next.keep) || next.keep < 1 || next.keep > 100) throw new VaultError('invalid', 'Mantenha entre 1 e 100 backups.')
    this.settings.autoBackup = next
    await this.persistSettings()
    return this.state()
  }

  autoBackupDue(): boolean {
    const a = this.settings.autoBackup
    if (!a.enabled || !a.folder || !this.repo || this.autoBackupRunning) return false
    return !a.lastSuccessAt || this.clock().getTime() - Date.parse(a.lastSuccessAt) >= DAY_MS
  }

  async runAutoBackup(force = false): Promise<AppState> {
    const a = this.settings.autoBackup
    if (!this.repo) throw new VaultError('not-found', 'Nenhum vault aberto.')
    if (!a.folder) throw new VaultError('invalid', 'Escolha a pasta do backup automático.')
    if (!force && !this.autoBackupDue()) return this.state()
    if (this.autoBackupRunning) return this.state()
    this.autoBackupRunning = true
    const at = this.clock()
    try {
      const target = join(a.folder, autoBackupName(at))
      // Decisão permanente registrada na configuração: incluir conteúdo não canônico (nada omitido)
      // e excluir só os arquivos de sistema da lista fechada (Thumbs.db, desktop.ini, .DS_Store).
      const result = await exportBackup(this.repo.root, target, {
        decide: (inventory) => ({ nonCanonical: Object.fromEntries(inventory.nonCanonical.map((f) => [f.path, 'include' as const])), systemFiles: 'exclude' }),
        maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO,
        now: () => at
      })
      const removed = await rotateAutoBackups(a.folder, a.keep, this.trash)
      this.settings.autoBackup = { ...this.settings.autoBackup, lastSuccessAt: at.toISOString(), last: { at: at.toISOString(), ok: true, message: `${result.manifest.file_count} arquivo(s) verificados${removed.length ? `; ${removed.length} backup(s) antigo(s) enviados para a Lixeira` : ''}.`, file: result.archivePath } }
    } catch (error) {
      const failed = fail(error)
      const message = failed.ok ? 'Falha desconhecida.' : failed.error.message + (Array.isArray(failed.error.details?.diagnostics) ? ` ${(failed.error.details!.diagnostics as Array<{ path: string; message: string }>).slice(0, 3).map((d) => `${d.path}: ${d.message}`).join(' · ')}` : '')
      this.settings.autoBackup = { ...this.settings.autoBackup, last: { at: at.toISOString(), ok: false, message, file: null } }
    } finally {
      this.autoBackupRunning = false
    }
    await this.persistSettings()
    return this.state()
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
