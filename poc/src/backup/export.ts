import { createHash, randomUUID } from 'node:crypto'
import type { FileHandle } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { Transform } from 'node:stream'
import { ZipFile } from 'yazl'
import { BackupFileSystem, isErrno } from './backup-fs.js'
import {
  BackupBlockedError,
  BackupCancelledError,
  BackupConcurrentChangeError,
  BackupDecisionError,
  BackupDestinationError,
  BackupVerificationError,
  BackupWriteError,
  type BackupDiagnostic
} from './errors.js'
import { scanVault, type InventoryFile, type VaultInventory } from './inventory.js'
import { buildManifest, compareUtf8, MANIFEST_PATH, manifestSizeBound, PATH_LIMITS, serializeManifest, type BackupManifest, type ManifestFile } from './manifest.js'
import { verifyBackupArchive } from './verify-archive.js'

export interface ExportDecisions {
  nonCanonical: Record<string, 'include' | 'exclude'>
  systemFiles?: 'include' | 'exclude'
}

export interface ExportHooks {
  // Ponto de injeção determinístico entre a coleta e a verificação final (AC-04/AC-05).
  afterArchiveWritten?: (context: { temporaryPath: string; finalPath: string }) => Promise<void>
  // Marca o início de cada fase, só para medição (AC-19); não altera o comportamento.
  phase?: (name: ExportPhase) => void
}

export type ExportPhase = 'inventory' | 'hash' | 'zip' | 'rescan' | 'rehash' | 'verify' | 'publish' | 'done'

export interface ExportOptions {
  decide: (inventory: VaultInventory) => ExportDecisions | 'cancel' | Promise<ExportDecisions | 'cancel'>
  fs?: BackupFileSystem
  now?: () => Date
  generateId?: () => string
  hooks?: ExportHooks
  // Só para o AC-13: força estruturas ZIP64 mesmo quando desnecessárias. O padrão segue a Z-B (ZIP64 só quando necessário).
  forceZip64?: boolean
}

export interface ExportResult {
  archivePath: string
  manifest: BackupManifest
  included: string[]
  excluded: Array<{ path: string; reason: 'temporary' | 'excluded-by-person' | 'system-file-excluded' }>
  emptyDirectories: string[]
  temporaryCleanupError?: unknown
}

function comparable(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

// Compara caminhos reais pelas regras do sistema de arquivos (no Windows/NTFS, sem caixa).
export function isWithin(parent: string, candidate: string): boolean {
  const rel = relative(comparable(parent), comparable(candidate))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function digestFile(fs: BackupFileSystem, path: string): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of fs.createReadStream(path)) {
    hash.update(chunk as Buffer)
    size += (chunk as Buffer).length
  }
  return { size, sha256: hash.digest('hex') }
}

function vaultPath(vaultRoot: string, path: string): string {
  return join(vaultRoot, ...path.split('/'))
}

function changed(path: string, message: string): BackupDiagnostic {
  return { category: 'concurrent-change', path, code: 'vault-changed', message }
}

async function writeArchive(
  fs: BackupFileSystem,
  handle: FileHandle,
  vaultRoot: string,
  manifest: BackupManifest,
  forceZip64 = false
): Promise<string[]> {
  const zip = new ZipFile()
  const output = fs.createTempWriteStream(handle)
  const mismatches: string[] = []
  const mtime = new Date(manifest.created_at)
  let fail: (error: unknown) => void = () => undefined
  const failed = new Promise<never>((_, reject) => { fail = reject })
  const finished = new Promise<void>((resolveFinished, reject) => {
    output.once('close', resolveFinished)
    output.once('error', reject)
    zip.once('error', reject)
  })
  zip.outputStream.pipe(output)

  for (const file of manifest.files) {
    // Sem compressão: nenhuma entrada pode exceder um limite de razão ainda não definido (A-01).
    zip.addReadStreamLazy(file.path, { compress: false, size: file.size, mtime, mode: 0o100644, forceZip64Format: forceZip64 }, (callback) => {
      const hash = createHash('sha256')
      const tap = new Transform({
        transform(chunk: Buffer, _encoding, next) {
          hash.update(chunk)
          next(null, chunk)
        },
        flush(next) {
          if (hash.digest('hex') !== file.sha256) mismatches.push(file.path)
          next()
        }
      })
      const source = fs.createReadStream(vaultPath(vaultRoot, file.path))
      source.once('error', (error) => {
        tap.destroy(error)
        fail(error)
      })
      tap.once('error', fail)
      callback(null, source.pipe(tap))
    })
  }
  zip.addBuffer(serializeManifest(manifest), MANIFEST_PATH, { compress: false, mtime, mode: 0o100644, forceZip64Format: forceZip64 })
  zip.end({ forceZip64Format: forceZip64, comment: '' })

  try {
    await Promise.race([finished, failed])
  } catch (error) {
    output.destroy()
    throw error
  }
  return mismatches
}

// Nova varredura sem seguir links e comparação com o inventário inicial (VAULT_CONTRACT §7.4 item 4).
async function detectChanges(
  fs: BackupFileSystem,
  vaultRoot: string,
  initial: VaultInventory,
  manifest: BackupManifest,
  phase: (name: ExportPhase) => void = () => undefined
): Promise<BackupDiagnostic[]> {
  const diagnostics: BackupDiagnostic[] = []
  phase('rescan')
  const rescan = await scanVault(vaultRoot, fs)
  for (const entry of rescan.blocks) diagnostics.push(changed(entry.path, `new blocking condition: ${entry.code}`))
  for (const [path, before] of initial.entries) {
    const after = rescan.entries.get(path)
    if (!after) diagnostics.push(changed(path, 'path removed or replaced during export'))
    else if (after.type !== before.type) diagnostics.push(changed(path, 'path changed type during export'))
  }
  for (const path of rescan.entries.keys()) {
    if (!initial.entries.has(path)) diagnostics.push(changed(path, 'path created during export'))
  }
  phase('rehash')
  for (const file of manifest.files) {
    const after = rescan.entries.get(file.path)
    if (!after || after.type !== 'file') continue
    if (after.size !== file.size) {
      diagnostics.push(changed(file.path, 'size changed during export'))
      continue
    }
    const digest = await digestFile(fs, vaultPath(vaultRoot, file.path))
    if (digest.sha256 !== file.sha256 || digest.size !== file.size) diagnostics.push(changed(file.path, 'content changed during export'))
  }
  return diagnostics
}

async function removeOwnTemporary(
  fs: BackupFileSystem,
  path: string,
  identity: string
): Promise<{ removed: boolean; error?: unknown }> {
  try {
    const stats = await fs.lstat(path)
    if (`${stats.dev}:${stats.ino}` !== identity) {
      return { removed: false, error: new Error('temporary path no longer holds the file created by this export') }
    }
    await fs.unlink(path)
    return { removed: true }
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return { removed: true }
    return { removed: false, error }
  }
}

// Espaço exigido na pasta de destino antes de escrever (D-015, C-3): dados + cabeçalhos ZIP por entrada + teto do manifesto.
export function exportSpaceRequirement(files: readonly { size: number }[]): number {
  const data = files.reduce((sum, file) => sum + file.size, 0)
  return data + files.length * (100 + 2 * PATH_LIMITS.maxPathBytes) + manifestSizeBound(files.length)
}

// Exportação da PoC: inventário, validação simétrica, M-B, C-A e publicação sem sobrescrita (VAULT_CONTRACT §7).
export async function exportBackup(vaultRoot: string, archivePath: string, options: ExportOptions): Promise<ExportResult> {
  const fs = options.fs ?? new BackupFileSystem()
  const now = options.now ?? (() => new Date())
  const generateId = options.generateId ?? randomUUID
  const phase = options.hooks?.phase ?? (() => undefined)

  const vaultReal = await fs.realpath(vaultRoot)
  const requested = resolve(archivePath)
  let parentReal: string
  try {
    parentReal = await fs.realpath(dirname(requested))
  } catch (error) {
    throw new BackupDestinationError(requested, `destination folder is not available: ${String(error)}`)
  }
  if (isWithin(vaultReal, parentReal)) throw new BackupDestinationError(requested, 'destination must be outside the vault (real path)')
  const finalPath = join(parentReal, basename(requested))
  try {
    await fs.lstat(finalPath)
    throw new BackupDestinationError(finalPath, 'destination already exists; backups are never overwritten')
  } catch (error) {
    if (!isErrno(error, 'ENOENT')) throw error
  }

  phase('inventory')
  const inventory = await scanVault(vaultReal, fs)
  if (inventory.blocks.length > 0) throw new BackupBlockedError(inventory.blocks)

  const decision = await options.decide(inventory)
  if (decision === 'cancel') throw new BackupCancelledError()
  const missing = inventory.nonCanonical.map((file) => file.path).filter((path) => !decision.nonCanonical[path])
  if (inventory.systemFiles.length > 0 && !decision.systemFiles) missing.push('(system files group)')
  if (missing.length > 0) throw new BackupDecisionError(missing)

  const excluded: ExportResult['excluded'] = inventory.temporaries.map((file) => ({ path: file.path, reason: 'temporary' as const }))
  const selected: InventoryFile[] = [...inventory.canonical]
  for (const file of inventory.nonCanonical) {
    if (decision.nonCanonical[file.path] === 'include') selected.push(file)
    else excluded.push({ path: file.path, reason: 'excluded-by-person' })
  }
  for (const file of inventory.systemFiles) {
    if (decision.systemFiles === 'include') selected.push(file)
    else excluded.push({ path: file.path, reason: 'system-file-excluded' })
  }
  selected.sort((left, right) => compareUtf8(left.path, right.path))
  excluded.sort((left, right) => compareUtf8(left.path, right.path))

  // Capacidade (D-015, C-3): falha controlada antes de criar o temporário.
  const required = exportSpaceRequirement(selected)
  const available = await fs.freeSpace(parentReal)
  if (available < BigInt(required)) {
    throw new BackupBlockedError([{ category: 'capacity', path: finalPath, code: 'insufficient-space', message: `destination needs ${required} bytes free; ${available} available` }])
  }

  // C-A item 2: SHA-256 e tamanho de cada arquivo incluído, em streaming.
  phase('hash')
  const files: ManifestFile[] = []
  for (const file of selected) {
    const digest = await digestFile(fs, vaultPath(vaultReal, file.path))
    if (digest.size !== file.size) throw new BackupConcurrentChangeError([changed(file.path, 'size changed while hashing')], true)
    files.push({ path: file.path, size: digest.size, sha256: digest.sha256 })
  }
  const manifest = buildManifest(files, now())

  const temporaryPath = join(parentReal, `.atlas-backup-${generateId()}.zip.tmp`)
  let handle: FileHandle
  try {
    handle = await fs.openExclusive(temporaryPath)
  } catch (error) {
    throw new BackupWriteError('create-temporary', error, temporaryPath, false)
  }
  const stats = await handle.stat({ bigint: true })
  const identity = `${stats.dev}:${stats.ino}`
  let open = true

  try {
    phase('zip')
    const mismatches = await writeArchive(fs, handle, vaultReal, manifest, options.forceZip64 ?? false)
    open = false
    if (mismatches.length > 0) {
      throw new BackupConcurrentChangeError(mismatches.map((path) => changed(path, 'content changed while writing the archive')), false)
    }

    await options.hooks?.afterArchiveWritten?.({ temporaryPath, finalPath })

    const changes = await detectChanges(fs, vaultReal, inventory, manifest, phase)
    if (changes.length > 0) throw new BackupConcurrentChangeError(changes, false)

    phase('verify')
    const verified = await verifyBackupArchive(temporaryPath)
    if (JSON.stringify(verified) !== JSON.stringify(manifest)) {
      throw new BackupVerificationError([{ category: 'integrity', path: MANIFEST_PATH, code: 'manifest-mismatch', message: 'archive manifest differs from the export manifest' }])
    }

    phase('publish')
    try {
      await fs.link(temporaryPath, finalPath)
    } catch (error) {
      if (isErrno(error, 'EEXIST')) throw new BackupDestinationError(finalPath, 'destination appeared during export; it was not overwritten')
      throw new BackupWriteError('publish', error, temporaryPath)
    }
  } catch (error) {
    if (open) await handle.close().catch(() => undefined)
    const cleanup = await removeOwnTemporary(fs, temporaryPath, identity)
    if (error instanceof BackupConcurrentChangeError) throw new BackupConcurrentChangeError(error.diagnostics, cleanup.removed, cleanup.error)
    if (error instanceof BackupVerificationError) throw new BackupVerificationError(error.diagnostics, cleanup.removed, cleanup.error)
    if (error instanceof BackupDestinationError) throw error
    if (error instanceof BackupWriteError) throw new BackupWriteError(error.stage, error.cause, temporaryPath, cleanup.removed, cleanup.error)
    throw new BackupWriteError('write-archive', error, temporaryPath, cleanup.removed, cleanup.error)
  }

  const result: ExportResult = {
    archivePath: finalPath,
    manifest,
    included: selected.map((file) => file.path),
    excluded,
    emptyDirectories: [...inventory.emptyDirectories].sort(compareUtf8)
  }
  const cleanup = await removeOwnTemporary(fs, temporaryPath, identity)
  if (!cleanup.removed) result.temporaryCleanupError = cleanup.error
  return result
}
