import { join } from 'node:path'
import { isMap, parseDocument } from 'yaml'
import { parseFrontmatterDocument } from '../core/frontmatter.js'
import { isUuidV4 } from '../core/identity.js'
import type { BackupFileSystem } from './backup-fs.js'
import type { BackupDiagnostic } from './errors.js'
import { collisionKey, isWellFormedName, MANIFEST_PATH, pathLimitProblem } from './manifest.js'

// Pastas de registros (DATA_MODEL §2) e conteúdo canônico adicional (D-014).
export const RECORD_DIRECTORIES = [
  'groups', 'tags', 'items', 'tasks', 'notes/work', 'notes/reading', 'notes/permanent', 'inbox'
] as const
export const CANONICAL_DIRECTORIES = new Set<string>([...RECORD_DIRECTORIES, 'notes', 'assets'])
export const SYSTEM_FILE_NAMES = ['thumbs.db', 'desktop.ini', '.ds_store']
// Versões suportadas pela PoC (DATA_MODEL §1 e §2.1; settings_version 1 decidido em 18/10/2026, só para a PoC).
export const SUPPORTED_RECORD_SCHEMA_VERSIONS: readonly number[] = [1]
export const SUPPORTED_SETTINGS_VERSIONS: readonly number[] = [1]

const uuidV4Pattern = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const recordName = new RegExp(`^(${uuidV4Pattern})\\.md$`, 'i')
const temporaryName = new RegExp(`^\\.tmp-${uuidV4Pattern}\\.md$`, 'i')
const pendingTransaction = /^inbox\/\.txn_[^/]+\.json$/

export type CanonicalKind = 'record' | 'attachment' | 'settings'

export interface InventoryFile {
  path: string
  size: number
}

export interface CanonicalFile extends InventoryFile {
  kind: CanonicalKind
}

export interface VaultInventory {
  canonical: CanonicalFile[]
  nonCanonical: InventoryFile[]
  systemFiles: InventoryFile[]
  temporaries: InventoryFile[]
  emptyDirectories: string[]
  blocks: BackupDiagnostic[]
  // Versões de schema encontradas nos registros válidos (versão derivada, D-014).
  schemaVersions: number[]
  // Todos os caminhos encontrados, com tipo e tamanho, para a nova varredura da C-A (§7.4 item 4).
  entries: Map<string, { type: 'file' | 'directory'; size: number }>
}

function block(diagnostics: BackupDiagnostic[], category: BackupDiagnostic['category'], path: string, code: string, message: string): void {
  diagnostics.push({ category, path, code, message })
}

function recordProblems(directory: string, fileId: string, bytes: Buffer): { category: BackupDiagnostic['category']; code: string; message: string } | { id: string; version: number } {
  let metadata: Record<string, unknown>
  try {
    metadata = parseFrontmatterDocument(bytes).metadata
  } catch (error) {
    return { category: 'structure', code: 'invalid-record-yaml', message: String(error instanceof Error ? error.message : error) }
  }
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { category: 'structure', code: 'invalid-record', message: 'frontmatter must be a mapping' }
  }
  if (!isUuidV4(metadata.id) || metadata.id.toLowerCase() !== fileId.toLowerCase()) {
    return { category: 'structure', code: 'record-id-mismatch', message: 'id must be the UUID v4 in the file name' }
  }
  if (!Object.hasOwn(metadata, 'schema_version') || !Number.isInteger(metadata.schema_version)) {
    return { category: 'structure', code: 'invalid-record', message: 'schema_version must be an integer' }
  }
  if (!SUPPORTED_RECORD_SCHEMA_VERSIONS.includes(metadata.schema_version as number)) {
    return { category: 'unsupported-version', code: 'unsupported-schema-version', message: `schema_version ${String(metadata.schema_version)} is not supported` }
  }
  if (directory !== 'inbox' && (typeof metadata.title !== 'string' || metadata.title.trim().length === 0)) {
    return { category: 'structure', code: 'invalid-record', message: 'title must be a non-empty string' }
  }
  if (directory.startsWith('notes/') && metadata.note_type !== directory.slice('notes/'.length)) {
    return { category: 'structure', code: 'record-folder-mismatch', message: 'note_type does not match the folder' }
  }
  return { id: fileId.toLowerCase(), version: metadata.schema_version as number }
}

function settingsProblem(bytes: Buffer): { category: BackupDiagnostic['category']; code: string; message: string } | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { category: 'structure', code: 'invalid-settings', message: 'settings.yml is not valid UTF-8' }
  }
  const document = parseDocument(text, { strict: true, uniqueKeys: true, logLevel: 'error' })
  if (document.errors.length > 0 || document.warnings.length > 0 || !isMap(document.contents)) {
    return { category: 'structure', code: 'invalid-settings', message: 'settings.yml must be a valid YAML mapping' }
  }
  const value = document.toJS({ maxAliasCount: 10 }) as Record<string, unknown>
  if (!Number.isInteger(value.settings_version)) {
    return { category: 'structure', code: 'invalid-settings', message: 'settings_version must be an integer' }
  }
  if (!SUPPORTED_SETTINGS_VERSIONS.includes(value.settings_version as number)) {
    return { category: 'unsupported-version', code: 'unsupported-settings-version', message: `settings_version ${String(value.settings_version)} is not supported` }
  }
  return null
}

// Percorre o vault sem seguir links e classifica cada entrada (VAULT_CONTRACT §7.2).
export async function scanVault(vaultRoot: string, fs: BackupFileSystem): Promise<VaultInventory> {
  const inventory: VaultInventory = {
    canonical: [], nonCanonical: [], systemFiles: [], temporaries: [], emptyDirectories: [], blocks: [], schemaVersions: [], entries: new Map()
  }
  const recordIds = new Map<string, string>()
  const collisionKeys = new Map<string, string>()

  async function visit(absolute: string, relative: string): Promise<void> {
    const children = await fs.readdir(absolute)
    if (children.length === 0 && relative !== '' && !CANONICAL_DIRECTORIES.has(relative)) inventory.emptyDirectories.push(relative)
    for (const child of children) {
      const childRelative = relative === '' ? child.name : `${relative}/${child.name}`
      const childAbsolute = join(absolute, child.name)
      if (!isWellFormedName(child.name)) {
        block(inventory.blocks, 'security', childRelative, 'name-not-utf8', 'name is not representable in UTF-8')
        continue
      }
      const key = collisionKey(childRelative)
      const previous = collisionKeys.get(key)
      if (previous !== undefined) {
        block(inventory.blocks, 'security', childRelative, 'ambiguous-name', `differs from ${previous} only by case or Unicode form`)
      }
      collisionKeys.set(key, childRelative)

      if (child.isSymbolicLink()) {
        block(inventory.blocks, 'security', childRelative, 'link-in-vault', 'symlink, junction or reparse point blocks export (S-A)')
        continue
      }
      if (child.isDirectory()) {
        inventory.entries.set(childRelative, { type: 'directory', size: 0 })
        await visit(childAbsolute, childRelative)
        continue
      }
      if (!child.isFile()) {
        block(inventory.blocks, 'security', childRelative, 'unsupported-entry', 'entry is neither a regular file nor a directory')
        continue
      }
      const stats = await fs.lstat(childAbsolute)
      if (!stats.isFile()) {
        block(inventory.blocks, 'security', childRelative, 'unsupported-entry', 'entry changed type while scanning')
        continue
      }
      const file = { path: childRelative, size: Number(stats.size) }
      inventory.entries.set(childRelative, { type: 'file', size: file.size })
      await classify(file, child.name, relative, childAbsolute)
    }
  }

  async function classify(file: InventoryFile, name: string, directory: string, absolute: string): Promise<void> {
    // Nome reservado só na raiz, comparado como no NTFS (sem caixa, forma Unicode NFC).
    if (collisionKey(file.path) === MANIFEST_PATH) {
      block(inventory.blocks, 'structure', file.path, 'reserved-name', 'manifest.json at the vault root is reserved for the backup manifest')
      return
    }
    if (temporaryName.test(name)) {
      inventory.temporaries.push(file)
      return
    }
    // Simetria com a restauração (§7.2 item 7): caminho fora dos limites da D-015 bloqueia.
    const limitProblem = pathLimitProblem(file.path)
    if (limitProblem) {
      block(inventory.blocks, 'security', file.path, limitProblem.code, limitProblem.message)
      return
    }
    if (pendingTransaction.test(file.path)) {
      block(inventory.blocks, 'pending-transaction', file.path, 'pending-transaction', 'pending Inbox transaction must be resolved before export (D-007)')
      return
    }
    if (SYSTEM_FILE_NAMES.includes(name.toLowerCase())) {
      inventory.systemFiles.push(file)
      return
    }
    if (file.path === 'settings.yml') {
      const problem = settingsProblem(await fs.readFile(absolute))
      if (problem) block(inventory.blocks, problem.category, file.path, problem.code, problem.message)
      else inventory.canonical.push({ ...file, kind: 'settings' })
      return
    }
    if (file.path.startsWith('assets/')) {
      inventory.canonical.push({ ...file, kind: 'attachment' })
      return
    }
    const match = recordName.exec(name)
    if (match && (RECORD_DIRECTORIES as readonly string[]).includes(directory)) {
      const result = recordProblems(directory, match[1], await fs.readFile(absolute))
      if ('code' in result) {
        block(inventory.blocks, result.category, file.path, result.code, result.message)
        return
      }
      const other = recordIds.get(result.id)
      if (other !== undefined) {
        block(inventory.blocks, 'structure', file.path, 'duplicate-uuid', `same UUID as ${other}`)
        return
      }
      recordIds.set(result.id, file.path)
      if (!inventory.schemaVersions.includes(result.version)) inventory.schemaVersions.push(result.version)
      inventory.canonical.push({ ...file, kind: 'record' })
      return
    }
    inventory.nonCanonical.push(file)
  }

  await visit(vaultRoot, '')
  return inventory
}
