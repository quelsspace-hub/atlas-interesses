import { validateCompressionLimit, type CompressionPolicy } from './compression.js'
import { createHash, randomUUID } from 'node:crypto'
import type { FileHandle } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type * as yauzl from 'yauzl'
import { parseFrontmatterDocument } from '../core/frontmatter.js'
import { isUuidV4 } from '../core/identity.js'
import { BackupFileSystem, isErrno } from './backup-fs.js'
import { BackupDestinationError, BackupVerificationError, type BackupDiagnostic } from './errors.js'
import { isWithin } from './export.js'
import { CANONICAL_DIRECTORIES, scanVault, type VaultInventory } from './inventory.js'
import { backupPathProblem, compareUtf8, type BackupManifest } from './manifest.js'
import { listEntries, openArchive, openEntry, verifyBackupArchive } from './verify-archive.js'

// Restauração da PoC em pasta nova criada pelo aplicativo (VAULT_CONTRACT §7.7).
export type RestoreState = 'verified' | 'verified-with-warnings' | 'failed' | 'interrupted'
export type RestoreStage = 'pre-validation' | 'destination' | 'extraction' | 'validation'
export const ACTIVE_VAULT_NOTICE = 'O vault ativo não foi alterado.'
const JOURNAL_DIRECTORY = 'restore-journals'
const MARKER_DIRECTORY = 'unverified-copies'
const pendingTransaction = /^inbox\/\.txn_[^/]+\.json$/

export interface RestoreDiagnostic extends BackupDiagnostic {
  stage: RestoreStage
}

export interface RestoreSummary {
  manifest_version: number
  created_at: string
  file_count: number
  total_size: number
  counts_by_area: Record<string, number>
  destination: string
}

export interface RestoreReport {
  restoreId: string
  state: RestoreState
  backup: { fileName: string; size: number; sha256: string; manifest_version?: number; created_at?: string }
  destination?: string
  destinationCreated: boolean
  startedAt: string
  finishedAt: string
  appVersion: string
  counts: { expected: number; extracted: number; verified: number }
  schemaVersions: number[]
  errors: RestoreDiagnostic[]
  warnings: BackupDiagnostic[]
  notice: string
  canOpen: boolean
}

export interface RestoreHooks {
  // Injeção determinística depois de cada arquivo extraído (AC-15).
  afterFileWritten?: (path: string, index: number) => Promise<'continue' | 'cancel' | void> | 'continue' | 'cancel' | void
  // Marca o início de cada fase, só para medição (AC-19); não altera o comportamento.
  phase?: (name: RestorePhase) => void
}

export type RestorePhase = 'pre-digest' | 'pre-verify' | 'destination' | 'directories' | 'extraction' | 'validation' | 'references' | 'done'

// Limite do caminho absoluto no destino (D-015, C-4), em unidades UTF-16, sem o NUL final.
// Sem suporte a caminhos longos comprovado: 259 para arquivos e 247 para diretórios (MAX_PATH e MAX_PATH − 12).
// Quem souber que o aplicativo e o sistema oferecem caminhos longos passa o limite real (cerca de 32.767).
export interface DestinationPathLimits {
  file: number
  directory: number
}

export const DEFAULT_DESTINATION_PATH_LIMITS: DestinationPathLimits = { file: 259, directory: 247 }

export interface RestoreOptions extends CompressionPolicy {
  parentDirectory: string
  folderName: string
  appDataDirectory: string
  activeVaultRoot?: string
  confirm: (summary: RestoreSummary) => boolean | Promise<boolean>
  fs?: BackupFileSystem
  now?: () => Date
  generateId?: () => string
  appVersion?: string
  hooks?: RestoreHooks
  pathLimits?: DestinationPathLimits
}

type JournalEntry =
  | { type: 'start'; restore_id: string; destination: string; archive_sha256: string; started_at: string }
  | { type: 'intent'; kind: 'directory' | 'file'; path: string; sha256?: string }
  | { type: 'created'; kind: 'directory' | 'file'; path: string; identity: string }
  | { type: 'not-created'; kind: 'directory' | 'file'; path: string }
  | { type: 'state'; state: RestoreState }

class RestoreAbort extends Error {
  constructor(readonly stage: RestoreStage, readonly diagnostic: BackupDiagnostic) {
    super(diagnostic.message)
  }
}

class Journal {
  private constructor(private readonly fs: BackupFileSystem, private readonly handle: FileHandle, readonly path: string) {}

  static async create(fs: BackupFileSystem, directory: string, id: string): Promise<Journal> {
    await fs.ensureDirectory(directory)
    const path = join(directory, `${id}.jsonl`)
    return new Journal(fs, await fs.openExclusive(path), path)
  }

  record(entry: JournalEntry): Promise<void> {
    return this.fs.journalAppend(this.handle, `${JSON.stringify(entry)}\n`)
  }

  async close(): Promise<void> {
    await this.handle.close().catch(() => undefined)
  }
}

function identityOf(stats: { dev: bigint; ino: bigint }): string {
  return `${stats.dev}:${stats.ino}`
}

function under(root: string, path: string): string {
  return path === '' ? root : join(root, ...path.split('/'))
}

function depth(path: string): number {
  return path === '' ? 0 : path.split('/').length
}

async function digestPath(fs: BackupFileSystem, path: string): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of fs.createReadStream(path)) {
    hash.update(chunk as Buffer)
    size += (chunk as Buffer).length
  }
  return { size, sha256: hash.digest('hex') }
}

function folderNameProblem(name: string): string | null {
  if (name.includes('/') || name.includes('\\') || name.includes(':')) return 'folder name must be a single path segment'
  return backupPathProblem(name)
}

async function missingReferences(fs: BackupFileSystem, root: string, inventory: VaultInventory): Promise<BackupDiagnostic[]> {
  const records: Array<{ path: string; metadata: Record<string, unknown> }> = []
  for (const file of inventory.canonical) {
    if (file.kind !== 'record') continue
    records.push({ path: file.path, metadata: parseFrontmatterDocument(await fs.readFile(under(root, file.path))).metadata })
  }
  const ids = new Set(records.map((entry) => String(entry.metadata.id).toLowerCase()))
  const warnings: BackupDiagnostic[] = []
  for (const { path, metadata } of records) {
    for (const [key, value] of Object.entries(metadata)) {
      if (key === 'id') continue
      const references = key.endsWith('_ids') && Array.isArray(value) ? value : key.endsWith('_id') ? [value] : []
      for (const reference of references) {
        if (isUuidV4(reference) && !ids.has(reference.toLowerCase())) {
          warnings.push({ category: 'structure', path, code: 'missing-reference', message: `${key} references ${reference}, which is not in the backup` })
        }
      }
    }
  }
  return warnings
}

export async function restoreBackup(archivePath: string, options: RestoreOptions): Promise<RestoreReport> {
  const fs = options.fs ?? new BackupFileSystem()
  const now = options.now ?? (() => new Date())
  const restoreId = (options.generateId ?? randomUUID)()
  const phase = options.hooks?.phase ?? (() => undefined)
  const report: RestoreReport = {
    restoreId,
    state: 'failed',
    backup: { fileName: basename(archivePath), size: 0, sha256: '' },
    destinationCreated: false,
    startedAt: now().toISOString(),
    finishedAt: '',
    appVersion: options.appVersion ?? 'atlas-persistence-poc',
    counts: { expected: 0, extracted: 0, verified: 0 },
    schemaVersions: [],
    errors: [],
    warnings: [],
    notice: ACTIVE_VAULT_NOTICE,
    canOpen: false
  }
  const finish = (state: RestoreState): RestoreReport => {
    report.state = state
    report.finishedAt = now().toISOString()
    report.canOpen = state === 'verified' || state === 'verified-with-warnings'
    return report
  }
  const fail = (stage: RestoreStage, diagnostic: BackupDiagnostic) => report.errors.push({ ...diagnostic, stage })

  // Copiar a política antes de callbacks/awaits impede alteração durante a operação.
  let policy: CompressionPolicy
  try {
    policy = { maxCompressionRatio: validateCompressionLimit(options.maxCompressionRatio) }
  } catch (error) {
    fail('pre-validation', { category: 'security', path: archivePath, code: 'invalid-compression-limit', message: String(error) })
    return finish('failed')
  }

  // 1. Pré-validação do ZIP, sem escrever nada.
  phase('pre-digest')
  try {
    const digest = await digestPath(fs, archivePath)
    report.backup.size = digest.size
    report.backup.sha256 = digest.sha256
  } catch (error) {
    fail('pre-validation', { category: 'io', path: archivePath, code: 'archive-unreadable', message: String(error) })
    return finish('failed')
  }
  let manifest: BackupManifest
  phase('pre-verify')
  try {
    manifest = await verifyBackupArchive(archivePath, policy)
  } catch (error) {
    if (error instanceof BackupVerificationError) for (const entry of error.diagnostics) fail('pre-validation', entry)
    else fail('pre-validation', { category: 'structure', path: archivePath, code: 'invalid-archive', message: String(error) })
    return finish('failed')
  }
  report.backup.manifest_version = manifest.manifest_version
  report.backup.created_at = manifest.created_at
  report.counts.expected = manifest.file_count
  for (const file of manifest.files) {
    if (pendingTransaction.test(file.path)) {
      fail('pre-validation', { category: 'pending-transaction', path: file.path, code: 'pending-transaction', message: 'a valid backup never contains a pending Inbox transaction' })
    }
  }
  if (report.errors.length > 0) return finish('failed')

  // 2. Destino por caminho real, sem escrever nada (§7.6, §7.7 item 1).
  const destinationFail = (code: string, message: string, category: BackupDiagnostic['category'] = 'destination') =>
    fail('destination', { category, path: options.folderName, code, message })
  phase('destination')
  const nameProblem = folderNameProblem(options.folderName)
  if (nameProblem) destinationFail('invalid-folder-name', nameProblem)
  let parentReal = ''
  let appDataReal = ''
  let activeReal: string | undefined
  try {
    parentReal = await fs.realpath(options.parentDirectory)
    if (!(await fs.lstat(parentReal)).isDirectory()) destinationFail('parent-not-directory', 'parent folder is not a directory')
  } catch (error) {
    destinationFail('parent-unavailable', String(error))
  }
  try {
    if (options.activeVaultRoot !== undefined) activeReal = await fs.realpath(options.activeVaultRoot)
  } catch (error) {
    destinationFail('active-vault-unavailable', String(error))
  }
  if (report.errors.length > 0) return finish('failed')

  const destination = join(parentReal, options.folderName)
  if (activeReal && (isWithin(activeReal, parentReal) || isWithin(parentReal, activeReal))) {
    destinationFail('overlaps-active-vault', 'parent folder overlaps the active vault (real path)')
  }
  try {
    await fs.ensureDirectory(options.appDataDirectory)
    appDataReal = await fs.realpath(options.appDataDirectory)
    if ((activeReal && isWithin(activeReal, appDataReal)) || isWithin(destination, appDataReal)) {
      destinationFail('app-data-overlaps', 'application data must stay outside the active vault and the destination')
    }
  } catch (error) {
    destinationFail('app-data-unavailable', String(error))
  }
  try {
    await fs.lstat(destination)
    destinationFail('destination-exists', 'an existing folder is never used as destination')
  } catch (error) {
    if (!isErrno(error, 'ENOENT')) destinationFail('destination-unavailable', String(error))
  }
  const totalSize = manifest.files.reduce((sum, file) => sum + file.size, 0)
  // Caminho absoluto no destino (D-015, C-4): conferido antes da confirmação, sem escrever nada.
  if (report.errors.length === 0) {
    const limits = options.pathLimits ?? DEFAULT_DESTINATION_PATH_LIMITS
    const directories = new Set<string>(['', ...CANONICAL_DIRECTORIES])
    for (const file of manifest.files) {
      const parts = file.path.split('/')
      for (let index = 1; index < parts.length; index += 1) directories.add(parts.slice(0, index).join('/'))
    }
    const tooLong = (path: string, kind: 'file' | 'directory') => {
      const length = path === '' ? destination.length : destination.length + 1 + path.length
      if (length > limits[kind]) {
        fail('destination', { category: 'capacity', path: path || options.folderName, code: 'absolute-path-too-long', message: `absolute ${kind} path would have ${length} characters; the limit available is ${limits[kind]}. Choose a shorter destination folder.` })
      }
    }
    for (const path of directories) tooLong(path, 'directory')
    for (const file of manifest.files) tooLong(file.path, 'file')
  }
  if (report.errors.length === 0) {
    try {
      if ((await fs.freeSpace(parentReal)) < BigInt(totalSize)) destinationFail('insufficient-space', 'not enough free space at the destination', 'capacity')
    } catch (error) {
      destinationFail('free-space-unknown', String(error), 'capacity')
    }
  }
  if (report.errors.length > 0) return finish('failed')
  report.destination = destination

  // 3. Confirmação; cancelar aqui não cria nada.
  const countsByArea: Record<string, number> = {}
  for (const file of manifest.files) {
    const area = file.path.startsWith('notes/') ? file.path.split('/').slice(0, 2).join('/') : file.path.split('/')[0]
    countsByArea[area] = (countsByArea[area] ?? 0) + 1
  }
  const confirmed = await options.confirm({
    manifest_version: manifest.manifest_version,
    created_at: manifest.created_at,
    file_count: manifest.file_count,
    total_size: totalSize,
    counts_by_area: countsByArea,
    destination
  })
  if (!confirmed) return finish('interrupted')

  // 4. Diário antes de cada item; criação exclusiva; extração em streaming.
  let journal: Journal
  try {
    journal = await Journal.create(fs, join(appDataReal, JOURNAL_DIRECTORY), restoreId)
  } catch (error) {
    destinationFail('journal-unavailable', String(error), 'io')
    return finish('failed')
  }

  let zipfile: yauzl.ZipFile | undefined
  try {
    await journal.record({ type: 'start', restore_id: restoreId, destination, archive_sha256: report.backup.sha256, started_at: report.startedAt })

    const createDirectory = async (path: string) => {
      const absolute = under(destination, path)
      if (path !== '') {
        const parent = await fs.lstat(dirname(absolute))
        if (parent.isSymbolicLink() || !parent.isDirectory()) {
          throw new RestoreAbort('extraction', { category: 'security', path, code: 'unsafe-destination', message: 'parent is not a directory created by this restore' })
        }
      }
      await journal.record({ type: 'intent', kind: 'directory', path })
      try {
        await fs.mkdirExclusive(absolute)
      } catch (error) {
        await journal.record({ type: 'not-created', kind: 'directory', path })
        throw new RestoreAbort(path === '' ? 'destination' : 'extraction', { category: 'destination', path: path || options.folderName, code: 'create-failed', message: String(error) })
      }
      await journal.record({ type: 'created', kind: 'directory', path, identity: identityOf(await fs.lstat(absolute)) })
    }

    phase('directories')
    await createDirectory('')
    report.destinationCreated = true

    const directories = new Set<string>(CANONICAL_DIRECTORIES)
    for (const file of manifest.files) {
      const parts = file.path.split('/')
      for (let index = 1; index < parts.length; index += 1) directories.add(parts.slice(0, index).join('/'))
    }
    const orderedDirectories = [...directories].sort((left, right) => depth(left) - depth(right) || compareUtf8(left, right))
    for (const path of orderedDirectories) await createDirectory(path)

    phase('extraction')
    zipfile = await openArchive(archivePath)
    const entries = new Map((await listEntries(zipfile)).map((entry) => [entry.fileName, entry]))
    let cancelled = false
    for (const [index, file] of manifest.files.entries()) {
      const entry = entries.get(file.path)
      if (!entry) throw new RestoreAbort('extraction', { category: 'integrity', path: file.path, code: 'missing-entry', message: 'archive changed after pre-validation' })
      const absolute = under(destination, file.path)
      if (!isWithin(destination, absolute)) throw new RestoreAbort('extraction', { category: 'security', path: file.path, code: 'unsafe-path', message: 'path escapes the destination' })
      const parent = await fs.lstat(dirname(absolute))
      if (parent.isSymbolicLink() || !parent.isDirectory()) {
        throw new RestoreAbort('extraction', { category: 'security', path: file.path, code: 'unsafe-destination', message: 'parent is not a directory created by this restore' })
      }

      await journal.record({ type: 'intent', kind: 'file', path: file.path, sha256: file.sha256 })
      let handle: FileHandle
      try {
        handle = await fs.openExclusive(absolute)
      } catch (error) {
        await journal.record({ type: 'not-created', kind: 'file', path: file.path })
        throw new RestoreAbort('extraction', { category: 'destination', path: file.path, code: 'create-failed', message: String(error) })
      }
      await journal.record({ type: 'created', kind: 'file', path: file.path, identity: identityOf(await handle.stat({ bigint: true })) })

      const hash = createHash('sha256')
      let size = 0
      const tap = new Transform({
        transform(chunk: Buffer, _encoding, next) {
          hash.update(chunk)
          size += chunk.length
          next(null, chunk)
        }
      })
      await pipeline(await openEntry(zipfile, entry, policy), tap, fs.createTempWriteStream(handle))
      report.counts.extracted += 1
      if (size !== file.size || hash.digest('hex') !== file.sha256) {
        throw new RestoreAbort('extraction', { category: 'integrity', path: file.path, code: 'hash-mismatch', message: 'extracted bytes differ from the manifest' })
      }
      report.counts.verified += 1
      if ((await options.hooks?.afterFileWritten?.(file.path, index)) === 'cancel') {
        cancelled = true
        break
      }
    }
    zipfile.close()
    zipfile = undefined

    if (cancelled) {
      await journal.record({ type: 'state', state: 'interrupted' })
      return finish('interrupted')
    }

    // 5. Validação dos registros restaurados (§7.7 itens 4 a 6).
    phase('validation')
    const inventory = await scanVault(destination, fs)
    for (const entry of inventory.blocks) fail('validation', entry)
    report.schemaVersions = [...inventory.schemaVersions].sort((left, right) => left - right)
    if (report.errors.length > 0) {
      await journal.record({ type: 'state', state: 'failed' })
      return finish('failed')
    }
    phase('references')
    report.warnings = await missingReferences(fs, destination, inventory)
    const state: RestoreState = report.warnings.length > 0 ? 'verified-with-warnings' : 'verified'
    await journal.record({ type: 'state', state })
    await journal.close()
    await fs.unlink(journal.path)
    return finish(state)
  } catch (error) {
    if (error instanceof RestoreAbort) fail(error.stage, error.diagnostic)
    else fail('extraction', { category: 'io', path: report.destination ?? options.folderName, code: 'io-error', message: String(error) })
    // Se o diário também falhar, ele fica incompleto e o reinício trata a cópia como interrompida.
    await journal.record({ type: 'state', state: 'failed' }).catch(() => undefined)
    return finish('failed')
  } finally {
    zipfile?.close()
    await journal.close()
  }
}

export interface IncompleteRestore {
  restoreId: string
  destination: string
  archiveSha256: string
  state: 'failed' | 'interrupted'
  canOpen: false
}

async function readJournal(fs: BackupFileSystem, path: string): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = []
  for (const line of (await fs.readFile(path)).toString('utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      entries.push(JSON.parse(line) as JournalEntry)
    } catch {
      break
    }
  }
  return entries
}

// No reinício: diários restantes indicam cópias não verificadas (§7.7 item 8).
export async function findIncompleteRestores(appDataDirectory: string, fs = new BackupFileSystem()): Promise<IncompleteRestore[]> {
  const directory = join(appDataDirectory, JOURNAL_DIRECTORY)
  let names: string[]
  try {
    names = (await fs.readdir(directory)).filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).map((entry) => entry.name)
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return []
    throw error
  }
  const result: IncompleteRestore[] = []
  for (const name of names.sort()) {
    const entries = await readJournal(fs, join(directory, name))
    const start = entries.find((entry) => entry.type === 'start')
    if (!start || start.type !== 'start') continue
    const last = [...entries].reverse().find((entry) => entry.type === 'state')
    const state = last && last.type === 'state' && last.state === 'failed' ? 'failed' : 'interrupted'
    result.push({ restoreId: start.restore_id, destination: start.destination, archiveSha256: start.archive_sha256, state, canOpen: false })
  }
  return result
}

export interface UnverifiedCopyMarker {
  restore_id: string
  destination: string
  status: 'não verificado'
  date: string
  archive_sha256: string
}

export interface ResolutionResult {
  removed: string[]
  preserved: string[]
  destinationExists: boolean
  marker?: UnverifiedCopyMarker
}

async function exists(fs: BackupFileSystem, path: string): Promise<boolean> {
  try {
    await fs.lstat(path)
    return true
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return false
    throw error
  }
}

async function listTree(fs: BackupFileSystem, root: string, prefix = ''): Promise<string[]> {
  const paths: string[] = []
  for (const entry of await fs.readdir(under(root, prefix))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    paths.push(path)
    if (entry.isDirectory() && !entry.isSymbolicLink()) paths.push(...await listTree(fs, root, path))
  }
  return paths
}

// Escolha explícita da pessoa (DQ-23): remover só o que o diário registrou, ou manter para diagnóstico.
export async function resolveIncompleteRestore(
  appDataDirectory: string,
  restoreId: string,
  choice: 'remove' | 'keep',
  options: { fs?: BackupFileSystem; now?: () => Date } = {}
): Promise<ResolutionResult> {
  const fs = options.fs ?? new BackupFileSystem()
  const now = options.now ?? (() => new Date())
  const journalPath = join(appDataDirectory, JOURNAL_DIRECTORY, `${restoreId}.jsonl`)
  const entries = await readJournal(fs, journalPath)
  const start = entries.find((entry) => entry.type === 'start')
  if (!start || start.type !== 'start') throw new BackupDestinationError(journalPath, 'restore journal has no start entry')
  const destination = start.destination
  const created = entries.filter((entry): entry is Extract<JournalEntry, { type: 'created' }> => entry.type === 'created')
  const removed: string[] = []
  const preserved: string[] = []

  if (choice === 'remove') {
    for (const entry of created.filter((item) => item.kind === 'file')) {
      const absolute = under(destination, entry.path)
      if (!isWithin(destination, absolute)) continue
      try {
        const stats = await fs.lstat(absolute)
        if (stats.isSymbolicLink() || !stats.isFile() || identityOf(stats) !== entry.identity) continue
        await fs.unlink(absolute)
        removed.push(entry.path)
      } catch (error) {
        if (!isErrno(error, 'ENOENT')) throw error
      }
    }
    const directories = created.filter((item) => item.kind === 'directory').sort((left, right) => depth(right.path) - depth(left.path) || compareUtf8(right.path, left.path))
    for (const entry of directories) {
      const absolute = under(destination, entry.path)
      if (entry.path !== '' && !isWithin(destination, absolute)) continue
      try {
        const stats = await fs.lstat(absolute)
        if (stats.isSymbolicLink() || !stats.isDirectory() || identityOf(stats) !== entry.identity) continue
        await fs.rmdir(absolute)
        removed.push(entry.path === '' ? '.' : entry.path)
      } catch (error) {
        if (isErrno(error, 'ENOENT')) continue
        if (isErrno(error, 'ENOTEMPTY') || isErrno(error, 'EEXIST') || isErrno(error, 'EPERM') || isErrno(error, 'EBUSY')) continue
        throw error
      }
    }
  }

  const destinationExists = await exists(fs, destination)
  if (destinationExists) preserved.push(...(await listTree(fs, destination)).sort(compareUtf8))
  await fs.unlink(journalPath)

  const result: ResolutionResult = { removed, preserved, destinationExists }
  if (destinationExists) {
    const marker: UnverifiedCopyMarker = {
      restore_id: restoreId,
      destination,
      status: 'não verificado',
      date: now().toISOString(),
      archive_sha256: start.archive_sha256
    }
    const markerDirectory = join(appDataDirectory, MARKER_DIRECTORY)
    await fs.ensureDirectory(markerDirectory)
    const handle = await fs.openExclusive(join(markerDirectory, `${restoreId}.json`))
    try {
      await handle.writeFile(`${JSON.stringify(marker, null, 2)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    result.marker = marker
  }
  return result
}

// Parte de dados do aviso ao abrir uma pasta (AC-17); a apresentação depende do aplicativo nativo.
export async function unverifiedCopyMarkerFor(appDataDirectory: string, folder: string, fs = new BackupFileSystem()): Promise<UnverifiedCopyMarker | null> {
  const directory = join(appDataDirectory, MARKER_DIRECTORY)
  let folderReal: string
  try {
    folderReal = await fs.realpath(folder)
  } catch {
    return null
  }
  let names: string[]
  try {
    names = (await fs.readdir(directory)).filter((entry) => entry.isFile()).map((entry) => entry.name)
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return null
    throw error
  }
  for (const name of names) {
    const marker = JSON.parse((await fs.readFile(join(directory, name))).toString('utf8')) as UnverifiedCopyMarker
    if (isWithin(marker.destination, folderReal) && isWithin(folderReal, marker.destination)) return marker
  }
  return null
}

export async function dismissUnverifiedCopy(appDataDirectory: string, restoreId: string, fs = new BackupFileSystem()): Promise<void> {
  try {
    await fs.unlink(join(appDataDirectory, MARKER_DIRECTORY, `${restoreId}.json`))
  } catch (error) {
    if (!isErrno(error, 'ENOENT')) throw error
  }
}

// "Salvar relatório": nunca dentro da cópia restaurada nem do vault ativo (§7.7 item 7).
export async function saveRestoreReport(
  report: RestoreReport,
  targetPath: string,
  options: { activeVaultRoot?: string; fs?: BackupFileSystem } = {}
): Promise<string> {
  const fs = options.fs ?? new BackupFileSystem()
  const parentReal = await fs.realpath(dirname(targetPath))
  const target = join(parentReal, basename(targetPath))
  if (report.destination && isWithin(report.destination, target)) throw new BackupDestinationError(target, 'report must be saved outside the restored copy')
  if (options.activeVaultRoot && isWithin(await fs.realpath(options.activeVaultRoot), target)) {
    throw new BackupDestinationError(target, 'report must be saved outside the active vault')
  }
  const handle = await fs.openExclusive(target)
  try {
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`)
  } finally {
    await handle.close()
  }
  return target
}
