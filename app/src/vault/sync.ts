import { link, readFile, readdir, stat, unlink } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { TextDecoder } from 'node:util'
import { FrontmatterDiagnosticError } from './core/errors.js'
import { sha256, snapshotOf } from './core/record.js'
import { VaultError, type ConflictCopy, type VaultRepository } from './repository.js'
import type { NoteType } from '../domain/model.js'
import { hasErrors, validateEntity } from '../domain/validate.js'

// V5 (D-031): sincronização por pasta. O Atlas não sincroniza; detecta e resolve o que o provedor deixou.
// Toda remoção vai para a Lixeira (`trash`), nunca é permanente.
export type Trash = (absolutePath: string) => Promise<void>

const utf8 = new TextDecoder('utf-8', { fatal: false })

export interface ConflictView extends ConflictCopy {
  copyText: string
  copyProblems: string[]
  currentText: string | null
  currentRevision: string | null
}

export async function describeConflict(repo: VaultRepository, conflict: ConflictCopy): Promise<ConflictView> {
  const copyBytes = await readFile(repo.abs(conflict.path))
  let currentBytes: Buffer | null = null
  try { currentBytes = await readFile(repo.abs(conflict.recordPath)) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  return { ...conflict, copyText: utf8.decode(copyBytes), copyProblems: copyProblems(conflict, copyBytes), currentText: currentBytes ? utf8.decode(currentBytes) : null, currentRevision: currentBytes ? sha256(currentBytes) : null }
}

function copyProblems(conflict: ConflictCopy, bytes: Buffer): string[] {
  let meta: Record<string, unknown>
  try {
    meta = snapshotOf(conflict.path, bytes).metadata
  } catch (error) {
    return [error instanceof FrontmatterDiagnosticError ? error.diagnostics.join('; ') : String((error as Error).message)]
  }
  const noteType = conflict.kind === 'note' ? (conflict.recordPath.split('/')[1] as NoteType) : undefined
  const problems = validateEntity(conflict.kind, meta, noteType).filter((p) => p.severity === 'error').map((p) => p.message)
  if (meta.id !== conflict.recordId) problems.push('o UUID da cópia não corresponde ao registro')
  return problems
}

function assertConflict(repo: VaultRepository, path: string): ConflictCopy {
  const conflict = repo.report().conflicts.find((c) => c.path === path)
  if (!conflict) throw new VaultError('not-found', 'Cópia de conflito não encontrada; releia o vault.')
  return conflict
}

// Manter a versão atual: a cópia vai para a Lixeira.
export async function keepCurrent(repo: VaultRepository, path: string, trash: Trash): Promise<void> {
  assertConflict(repo, path)
  await trash(repo.abs(path))
  await repo.load()
}

// Usar a cópia: valida, confere a revisão exibida da versão atual, manda a atual para a Lixeira e
// promove a cópia sem substituir nada (hard link exclusivo), depois remove o nome da cópia.
export async function useCopy(repo: VaultRepository, path: string, expectedCurrentRevision: string | null, trash: Trash): Promise<void> {
  const conflict = assertConflict(repo, path)
  const view = await describeConflict(repo, conflict)
  if (view.copyProblems.length > 0) throw new VaultError('invalid', `A cópia não é um registro válido: ${view.copyProblems.join('; ')}`)
  if (view.currentRevision !== expectedCurrentRevision) throw new VaultError('conflict', 'A versão atual mudou desde que foi exibida. Nada foi trocado; compare de novo.')
  const target = repo.abs(conflict.recordPath)
  if (view.currentRevision !== null) await trash(target)
  try {
    await link(repo.abs(conflict.path), target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new VaultError('conflict', 'Outro arquivo ocupou o nome do registro durante a troca. A versão anterior está na Lixeira; a cópia foi mantida.')
    throw error
  }
  await unlink(repo.abs(conflict.path))
  await repo.load()
}

// Lixeira de teste/E2E: move para uma pasta (ATLAS_TRASH_DIR), sem apagar.
export function folderTrash(directory: string): Trash {
  return async (absolutePath) => {
    const { mkdir, rename } = await import('node:fs/promises')
    await mkdir(directory, { recursive: true })
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}-${absolutePath.split(/[\\/]/).pop()}`
    await rename(absolutePath, join(directory, name))
  }
}

// Indicação informativa do provedor pelo caminho (D-031 §3).
export function syncProvider(vaultRoot: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const lower = vaultRoot.toLowerCase()
  const roots = [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter((p): p is string => !!p)
  if (roots.some((r) => lower === r.toLowerCase() || lower.startsWith(r.toLowerCase() + sep))) return 'OneDrive'
  if (/[\\/]onedrive( - [^\\/]+)?([\\/]|$)/i.test(vaultRoot)) return 'OneDrive'
  if (/[\\/]dropbox([\\/]|$)/i.test(vaultRoot)) return 'Dropbox'
  if (/[\\/](google drive|meu drive|my drive)([\\/]|$)/i.test(vaultRoot)) return 'Google Drive'
  if (/[\\/]sync(thing)?([\\/]|$)/i.test(vaultRoot)) return 'Syncthing'
  return null
}

// Backups automáticos: só arquivos com o padrão próprio entram na rotação.
export const AUTO_BACKUP_NAME = /^atlas-auto-\d{8}-\d{6}\.zip$/

export function autoBackupName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `atlas-auto-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.zip`
}

export async function rotateAutoBackups(folder: string, keep: number, trash: Trash): Promise<string[]> {
  const names = (await readdir(folder)).filter((n) => AUTO_BACKUP_NAME.test(n)).sort().reverse()
  const removed: string[] = []
  for (const name of names.slice(Math.max(1, keep))) {
    const path = join(folder, name)
    if ((await stat(path)).isFile()) { await trash(path); removed.push(name) }
  }
  return removed
}
