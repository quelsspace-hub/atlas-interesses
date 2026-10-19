import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { stringify } from 'yaml'
import { ZipFile } from 'yazl'
import { BackupFileSystem } from '../src/backup/backup-fs.js'
import { BackupDestinationError } from '../src/backup/errors.js'
import { exportBackup, type ExportDecisions } from '../src/backup/export.js'
import type { VaultInventory } from '../src/backup/inventory.js'
import { buildManifest, serializeManifest } from '../src/backup/manifest.js'
import {
  dismissUnverifiedCopy,
  findIncompleteRestores,
  resolveIncompleteRestore,
  restoreBackup,
  saveRestoreReport,
  unverifiedCopyMarkerFor,
  type RestoreOptions,
  type RestoreReport
} from '../src/backup/restore.js'
import { NodeFileStorage } from '../src/adapters/node-storage.js'
import { rebuildNoteLinkIndex } from '../src/core/note-link-index.js'
import { rebuildTagGroupIndex } from '../src/core/tag-group-index.js'

const temporaryDirectories: string[] = []
const NOW = new Date('2026-10-18T12:00:00.000Z')
const BODY_SECRET = 'SEGREDO-DO-CORPO-NAO-DEVE-IR-AO-RELATORIO'
const ids = {
  group: '11111111-1111-4111-8111-111111111111',
  tag: '22222222-2222-4222-8222-222222222222',
  item: '33333333-3333-4333-8333-333333333333',
  work: '55555555-5555-4555-8555-555555555555',
  permanent: '66666666-6666-4666-8666-666666666666',
  capture: '77777777-7777-4777-8777-777777777777',
  missing: '99999999-9999-4999-8999-999999999999'
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

interface Workspace { root: string; vault: string; out: string; restores: string; appData: string; sentinel: string }

async function workspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-restore-'))
  temporaryDirectories.push(root)
  const paths = { root, vault: join(root, 'vault'), out: join(root, 'out'), restores: join(root, 'restores'), appData: join(root, 'app-data'), sentinel: join(root, 'sentinela') }
  for (const path of [paths.vault, paths.out, paths.restores, paths.sentinel]) await mkdir(path)
  await writeFile(join(paths.sentinel, 'nao-tocar.txt'), 'sentinela')
  return paths
}

async function put(root: string, path: string, bytes: Buffer | string): Promise<void> {
  const target = join(root, ...path.split('/'))
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, bytes)
}

function record(metadata: Record<string, unknown>, body: string): string {
  return `---\n${stringify(metadata)}---\n${body}`
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) result.set(path, 'link')
      else if (entry.isDirectory()) {
        result.set(path, 'dir')
        await visit(join(directory, entry.name), path)
      } else result.set(path, sha256(await readFile(join(directory, entry.name))))
    }
  }
  await visit(root, '')
  return result
}

function includeAll(inventory: VaultInventory): ExportDecisions {
  return {
    nonCanonical: Object.fromEntries(inventory.nonCanonical.map((file) => [file.path, 'include' as const])),
    ...(inventory.systemFiles.length > 0 ? { systemFiles: 'include' as const } : {})
  }
}

async function referenceVault(vault: string, options: { missingTag?: boolean } = {}): Promise<void> {
  await put(vault, `tags/${ids.tag}.md`, record({ id: ids.tag, schema_version: 1, title: 'UX' }, 'Tag.\n'))
  await put(vault, `groups/${ids.group}.md`, record({ id: ids.group, schema_version: 1, title: 'Design', sort_order: 0, tag_ids: [ids.tag] }, 'Grupo.\n'))
  await put(vault, `items/${ids.item}.md`, record({ id: ids.item, schema_version: 1, title: 'Projeto', type: 'project', tag_ids: options.missingTag ? [ids.tag, ids.missing] : [ids.tag] }, `# Projeto\r\n\r\n${BODY_SECRET}\r\n`))
  await put(vault, `notes/work/${ids.work}.md`, record({ id: ids.work, schema_version: 1, title: 'Trabalho', note_type: 'work', context_item_id: ids.item, tag_ids: [] }, `Ver [permanente](../permanent/${ids.permanent}.md).\n`))
  await put(vault, `notes/permanent/${ids.permanent}.md`, record({ id: ids.permanent, schema_version: 1, title: 'Permanente', note_type: 'permanent', context_item_id: null, tag_ids: [] }, 'Conhecimento.\n'))
  await mkdir(join(vault, 'notes', 'reading'), { recursive: true })
  await put(vault, `inbox/${ids.capture}.md`, record({ id: ids.capture, schema_version: 1, capture_kind: 'thought', status: 'pending' }, 'Captura.\n'))
  await put(vault, 'assets/fotos/ação.bin', Buffer.from(Array.from({ length: 300 }, (_, index) => (index * 31) % 256)))
  await put(vault, 'settings.yml', 'settings_version: 1\n')
}

async function exportFrom(space: Workspace, options: { missingTag?: boolean } = {}): Promise<string> {
  await referenceVault(space.vault, options)
  const result = await exportBackup(space.vault, join(space.out, 'backup.zip'), { decide: includeAll, now: () => NOW })
  return result.archivePath
}

function restoreOptions(space: Workspace, extra: Partial<RestoreOptions> = {}): RestoreOptions {
  return {
    parentDirectory: space.restores,
    folderName: 'restaurado',
    appDataDirectory: space.appData,
    activeVaultRoot: space.vault,
    confirm: () => true,
    now: () => NOW,
    ...extra
  }
}

interface CraftedFile { name: string; bytes: Buffer; mode?: number }

async function craftArchive(
  path: string,
  files: CraftedFile[],
  options: { manifest?: unknown; manifestFiles?: CraftedFile[]; rename?: Array<[string, string]>; method?: [string, number]; encrypt?: string } = {}
): Promise<void> {
  const declared = options.manifestFiles ?? files
  const manifest = options.manifest ?? buildManifest(declared.map((file) => ({ path: file.name, size: file.bytes.length, sha256: sha256(file.bytes) })), NOW)
  const zip = new ZipFile()
  const chunks: Buffer[] = []
  const done = new Promise<void>((resolve, reject) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve())
    zip.outputStream.on('error', reject)
  })
  for (const file of files) zip.addBuffer(file.bytes, file.name, { compress: false, mtime: NOW, mode: file.mode ?? 0o100644 })
  const manifestBytes = typeof manifest === 'string' ? Buffer.from(manifest) : serializeManifest(manifest as ReturnType<typeof buildManifest>)
  zip.addBuffer(manifestBytes, 'manifest.json', { compress: false, mtime: NOW, mode: 0o100644 })
  zip.end()
  await done
  let bytes = Buffer.concat(chunks)
  for (const [placeholder, real] of options.rename ?? []) {
    assert.equal(placeholder.length, real.length)
    bytes = Buffer.from(bytes.toString('latin1').split(placeholder).join(real), 'latin1')
  }
  const patchHeaders = (name: string, apply: (buffer: Buffer, offset: number, central: boolean) => void) => {
    for (let offset = 0; offset < bytes.length - 4; offset += 1) {
      const signature = bytes.readUInt32LE(offset)
      if (signature === 0x04034b50) {
        const length = bytes.readUInt16LE(offset + 26)
        if (bytes.subarray(offset + 30, offset + 30 + length).toString('utf8') === name) apply(bytes, offset, false)
      } else if (signature === 0x02014b50) {
        const length = bytes.readUInt16LE(offset + 28)
        if (bytes.subarray(offset + 46, offset + 46 + length).toString('utf8') === name) apply(bytes, offset, true)
      }
    }
  }
  if (options.method) {
    const [name, method] = options.method
    patchHeaders(name, (buffer, offset, central) => buffer.writeUInt16LE(method, offset + (central ? 10 : 8)))
  }
  if (options.encrypt) {
    patchHeaders(options.encrypt, (buffer, offset, central) => {
      const at = offset + (central ? 8 : 6)
      buffer.writeUInt16LE(buffer.readUInt16LE(at) | 1, at)
    })
  }
  await writeFile(path, bytes)
}

const plain = (name: string, text = name): CraftedFile => ({ name, bytes: Buffer.from(text) })

class TrackingFileSystem extends BackupFileSystem {
  readonly events: Array<{ kind: 'journal' | 'create'; path: string; detail?: string }> = []

  override openExclusive(path: string): Promise<FileHandle> {
    this.events.push({ kind: 'create', path })
    return super.openExclusive(path)
  }

  override mkdirExclusive(path: string): Promise<void> {
    this.events.push({ kind: 'create', path })
    return super.mkdirExclusive(path)
  }

  override ensureDirectory(path: string): Promise<void> {
    this.events.push({ kind: 'create', path, detail: 'ensure' })
    return super.ensureDirectory(path)
  }

  override journalAppend(handle: FileHandle, line: string): Promise<void> {
    this.events.push({ kind: 'journal', path: '', detail: line })
    return super.journalAppend(handle, line)
  }
}

// Simula o fim do processo: a partir da N-ésima intenção de arquivo nada mais chega ao diário.
class CrashingFileSystem extends TrackingFileSystem {
  private fileIntents = 0
  private crashed = false
  constructor(private readonly crashAtFileIntent: number) { super() }

  override journalAppend(handle: FileHandle, line: string): Promise<void> {
    if (line.includes('"type":"intent","kind":"file"')) {
      this.fileIntents += 1
      if (this.fileIntents === this.crashAtFileIntent) this.crashed = true
    }
    if (this.crashed) return Promise.reject(new Error('simulated process end'))
    return super.journalAppend(handle, line)
  }
}

function isUnder(root: string, path: string): boolean {
  const left = root.toLowerCase()
  const right = path.toLowerCase()
  return right === left || right.startsWith(`${left}\\`) || right.startsWith(`${left}/`)
}

test('AC-02: restauração em pasta nova reproduz bytes, caminhos, pastas canônicas e índices', async () => {
  const space = await workspace()
  const archive = await exportFrom(space)
  const activeBefore = await snapshot(space.vault)
  const report = await restoreBackup(archive, restoreOptions(space))
  const destination = join(space.restores, 'restaurado')

  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
  assert.equal(report.canOpen, true)
  assert.equal(report.destination, destination)
  assert.equal(report.notice, 'O vault ativo não foi alterado.')
  assert.deepEqual(report.schemaVersions, [1])
  assert.equal(report.backup.manifest_version, 1)
  assert.equal(report.backup.created_at, NOW.toISOString())
  assert.equal(report.backup.sha256, sha256(await readFile(archive)))
  assert.equal(report.counts.expected, report.counts.verified)
  assert.equal(report.counts.extracted, report.counts.verified)
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.warnings, [])
  assert.equal(JSON.stringify(report).includes(BODY_SECRET), false)

  const source = await snapshot(space.vault)
  const restored = await snapshot(destination)
  for (const [path, hash] of source) {
    if (hash !== 'dir') assert.equal(restored.get(path), hash, path)
  }
  for (const directory of ['groups', 'tags', 'items', 'tasks', 'notes', 'notes/work', 'notes/reading', 'notes/permanent', 'inbox', 'assets']) {
    assert.equal(restored.get(directory), 'dir', directory)
  }
  const restoredFiles = [...restored].filter(([, hash]) => hash !== 'dir').map(([path]) => path).sort()
  const sourceFiles = [...source].filter(([, hash]) => hash !== 'dir').map(([path]) => path).sort()
  assert.deepEqual(restoredFiles, sourceFiles)

  // Índices são reconstruíveis: os da cópia restaurada coincidem com os do vault de origem.
  const storage = new NodeFileStorage()
  const tagIndex = (root: string) => rebuildTagGroupIndex({ tags: join(root, 'tags'), groups: join(root, 'groups'), items: join(root, 'items') }, storage)
  const noteIndex = (root: string) => rebuildNoteLinkIndex({ vaultRoot: root, notes: { work: join(root, 'notes', 'work'), reading: join(root, 'notes', 'reading'), permanent: join(root, 'notes', 'permanent') } }, storage)
  const sourceTags = await tagIndex(space.vault)
  const restoredTags = await tagIndex(destination)
  assert.deepEqual([...restoredTags.itemIdsByGroupId], [...sourceTags.itemIdsByGroupId])
  assert.deepEqual([...restoredTags.itemIdsByGroupId.get(ids.group) ?? []], [ids.item])
  const sourceNotes = await noteIndex(space.vault)
  const restoredNotes = await noteIndex(destination)
  assert.deepEqual([...restoredNotes.backlinksByNoteId], [...sourceNotes.backlinksByNoteId])
  assert.deepEqual([...restoredNotes.backlinksByNoteId.get(ids.permanent) ?? []], [ids.work])

  assert.deepEqual(await snapshot(space.vault), activeBefore)
  assert.deepEqual(await findIncompleteRestores(space.appData), [])
  assert.equal(await unverifiedCopyMarkerFor(space.appData, destination), null)
})

test('AC-02: relatório só é salvo fora da cópia restaurada e do vault ativo, sem sobrescrever', async () => {
  const space = await workspace()
  const archive = await exportFrom(space)
  const report = await restoreBackup(archive, restoreOptions(space))
  const destination = join(space.restores, 'restaurado')
  await assert.rejects(saveRestoreReport(report, join(destination, 'relatorio.json'), { activeVaultRoot: space.vault }), BackupDestinationError)
  await assert.rejects(saveRestoreReport(report, join(space.vault, 'relatorio.json'), { activeVaultRoot: space.vault }), BackupDestinationError)
  const saved = await saveRestoreReport(report, join(space.out, 'relatorio.json'), { activeVaultRoot: space.vault })
  assert.equal(JSON.parse((await readFile(saved)).toString('utf8')).state, 'verified')
  await assert.rejects(saveRestoreReport(report, join(space.out, 'relatorio.json'), { activeVaultRoot: space.vault }))
})

test('AC-06: ZIPs adulterados são recusados antes de qualquer escrita, com inspeção do sistema de arquivos', async (context) => {
  const good = [plain('assets/a.txt'), plain('assets/b.txt')]
  // Travessia, caminho absoluto e letra de unidade são barrados já pelo strictFileNames do yauzl
  // ao ler o diretório central (código invalid-central-directory, categoria security).
  const cases: Array<[string, (path: string) => Promise<void>, string]> = [
    ['hash errado', (path) => craftArchive(path, good, { manifestFiles: [plain('assets/a.txt', 'outro'), plain('assets/b.txt')] }), 'hash-mismatch'],
    ['tamanho errado', (path) => craftArchive(path, good, { manifest: { manifest_version: 1, created_at: NOW.toISOString(), file_count: 1, files: [{ path: 'assets/a.txt', size: 99, sha256: sha256(Buffer.from('assets/a.txt')) }] } }), 'size-mismatch'],
    ['entrada extra', (path) => craftArchive(path, good, { manifestFiles: [good[0]] }), 'undeclared-entry'],
    ['entrada ausente', (path) => craftArchive(path, [good[0]], { manifestFiles: good }), 'missing-entry'],
    ['duplicada', (path) => craftArchive(path, [good[0], good[0]], { manifestFiles: [good[0]] }), 'duplicate-entry'],
    ['duplicada por caixa', (path) => craftArchive(path, [plain('assets/A.txt'), plain('assets/a.txt')]), 'duplicate-entry'],
    ['duplicada por forma Unicode', (path) => craftArchive(path, [plain('assets/a\u00e7\u00e3o.txt'), plain('assets/ac\u0327a\u0303o.txt')]), 'duplicate-entry'],
    ['travessia ../', (path) => craftArchive(path, [plain('zz/escape.txt')], { rename: [['zz/escape.txt', '../escape.txt']] }), 'invalid-central-directory'],
    ['caminho absoluto', (path) => craftArchive(path, [plain('Xabsoluto.txt')], { rename: [['Xabsoluto.txt', '/absoluto.txt']] }), 'invalid-central-directory'],
    ['letra de unidade', (path) => craftArchive(path, [plain('QQ/unidade.txt')], { rename: [['QQ/unidade.txt', 'C:/unidade.txt']] }), 'invalid-central-directory'],
    ['entrada de link', (path) => craftArchive(path, [{ name: 'assets/link', bytes: Buffer.from('../../fora'), mode: 0o120777 }]), 'link-entry'],
    ['método não aceito', (path) => craftArchive(path, good, { method: ['assets/a.txt', 12] }), 'unsupported-method'],
    ['criptografada', (path) => craftArchive(path, good, { encrypt: 'assets/a.txt', method: ['assets/a.txt', 8] }), 'encrypted-entry'],
    ['manifesto inválido', (path) => craftArchive(path, good, { manifest: 'isto não é JSON' }), 'invalid-manifest'],
    ['manifest_version desconhecido', (path) => craftArchive(path, good, { manifest: { manifest_version: 2, created_at: NOW.toISOString(), file_count: 0, files: [] } }), 'invalid-manifest'],
    ['extensão A-08: transação da Inbox', (path) => craftArchive(path, [plain(`inbox/.txn_${ids.capture}.json`, '{}')]), 'pending-transaction']
  ]
  for (const [name, arrange, code] of cases) {
    await context.test(name, async () => {
      const space = await workspace()
      await referenceVault(space.vault)
      const archive = join(space.out, 'adulterado.zip')
      await arrange(archive)
      const before = { root: await snapshot(space.root) }
      const fs = new TrackingFileSystem()
      const report = await restoreBackup(archive, restoreOptions(space, { fs }))
      assert.equal(report.state, 'failed')
      assert.equal(report.canOpen, false)
      assert.ok(report.errors.some((entry) => entry.code === code), JSON.stringify(report.errors))
      assert.ok(report.errors.every((entry) => entry.stage === 'pre-validation'))
      assert.equal(report.destinationCreated, false)
      assert.deepEqual(await snapshot(space.root), before.root)
      assert.deepEqual(fs.events.filter((event) => event.kind === 'create'), [])
    })
  }
})

test('AC-06 extensão (A-10): versão não suportada bloqueia a disponibilização sem escrever fora do destino', async (context) => {
  const tag = (version: number) => ({ name: `tags/${ids.tag}.md`, bytes: Buffer.from(record({ id: ids.tag, schema_version: version, title: 'UX' }, 'Tag.\n')) })
  const cases: Array<[string, CraftedFile[], string]> = [
    ['schema_version de registro não suportado', [tag(2)], 'unsupported-schema-version'],
    ['settings_version não suportado', [tag(1), plain('settings.yml', 'settings_version: 2\n')], 'unsupported-settings-version']
  ]
  for (const [name, files, code] of cases) {
    await context.test(name, async () => {
      const space = await workspace()
      await referenceVault(space.vault)
      const archive = join(space.out, 'versao.zip')
      await craftArchive(archive, files)
      const activeBefore = await snapshot(space.vault)
      const sentinelBefore = await snapshot(space.sentinel)
      const fs = new TrackingFileSystem()
      const report = await restoreBackup(archive, restoreOptions(space, { fs }))
      const destination = join(space.restores, 'restaurado')
      assert.equal(report.state, 'failed')
      assert.equal(report.canOpen, false)
      assert.deepEqual(report.errors.map((entry) => [entry.code, entry.category, entry.stage]), [[code, 'unsupported-version', 'validation']])
      assert.deepEqual(await snapshot(space.vault), activeBefore)
      assert.deepEqual(await snapshot(space.sentinel), sentinelBefore)
      for (const event of fs.events.filter((item) => item.kind === 'create')) {
        assert.ok(isUnder(destination, event.path) || isUnder(space.appData, event.path), event.path)
      }
      assert.deepEqual((await findIncompleteRestores(space.appData)).map((entry) => entry.state), ['failed'])
    })
  }
})

class NoSpaceFileSystem extends BackupFileSystem {
  override async freeSpace(): Promise<bigint> {
    return 0n
  }
}

test('AC-08: destinos inválidos e cancelamento são recusados sem escrita; pasta-pai legítima com junção é aceita', async (context) => {
  const refusals: Array<[string, (space: Workspace) => Promise<Partial<RestoreOptions>>, string]> = [
    ['nome já existente (vazio)', async (space) => { await mkdir(join(space.restores, 'restaurado')); return {} }, 'destination-exists'],
    ['nome já existente (com conteúdo)', async (space) => { await put(space.restores, 'restaurado/x.txt', 'x'); return {} }, 'destination-exists'],
    ['pasta-pai dentro do vault ativo', async (space) => ({ parentDirectory: join(space.vault, 'assets') }), 'overlaps-active-vault'],
    ['pasta-pai que contém o vault ativo', async (space) => ({ parentDirectory: space.root }), 'overlaps-active-vault'],
    ['pasta-pai por junção que cai no vault ativo', async (space) => {
      await symlink(join(space.vault, 'assets'), join(space.root, 'juncao-para-vault'), 'junction')
      return { parentDirectory: join(space.root, 'juncao-para-vault') }
    }, 'overlaps-active-vault'],
    ['vault ativo aberto por junção, pasta-pai real dentro dele', async (space) => {
      await symlink(space.vault, join(space.root, 'vault-por-juncao'), 'junction')
      return { activeVaultRoot: join(space.root, 'vault-por-juncao'), parentDirectory: join(space.vault, 'notes') }
    }, 'overlaps-active-vault'],
    ['vault ativo com outra grafia de maiúsculas', async (space) => ({ activeVaultRoot: space.vault.toUpperCase(), parentDirectory: join(space.vault, 'notes') }), 'overlaps-active-vault'],
    ['espaço livre insuficiente', async () => ({ fs: new NoSpaceFileSystem() }), 'insufficient-space'],
    ['nome de pasta com separador', async () => ({ folderName: 'a/b' }), 'invalid-folder-name']
  ]
  for (const [name, arrange, code] of refusals) {
    await context.test(name, async () => {
      const space = await workspace()
      const archive = await exportFrom(space)
      const extra = await arrange(space)
      const before = await snapshot(space.root)
      const report = await restoreBackup(archive, restoreOptions(space, extra))
      assert.equal(report.state, 'failed')
      assert.ok(report.errors.some((entry) => entry.code === code), JSON.stringify(report.errors))
      assert.equal(report.destinationCreated, false)
      const after = await snapshot(space.root)
      for (const path of [...after.keys()].filter((key) => key.startsWith('app-data'))) after.delete(path)
      for (const path of [...before.keys()].filter((key) => key.startsWith('app-data'))) before.delete(path)
      assert.deepEqual(after, before)
    })
  }

  await context.test('cancelamento na confirmação não cria pasta nem diário', async () => {
    const space = await workspace()
    const archive = await exportFrom(space)
    let summary: unknown
    const report = await restoreBackup(archive, restoreOptions(space, { confirm: (value) => { summary = value; return false } }))
    assert.equal(report.state, 'interrupted')
    assert.equal(report.destinationCreated, false)
    assert.ok(summary)
    assert.deepEqual(await readdir(space.restores), [])
    assert.deepEqual(await findIncompleteRestores(space.appData), [])
  })

  await context.test('pasta-pai legítima com junção fora do vault é aceita', async () => {
    const space = await workspace()
    const archive = await exportFrom(space)
    await symlink(space.restores, join(space.root, 'juncao-legitima'), 'junction')
    const report = await restoreBackup(archive, restoreOptions(space, { parentDirectory: join(space.root, 'juncao-legitima') }))
    assert.equal(report.state, 'verified', JSON.stringify(report.errors))
    assert.equal(report.destination, join(space.restores, 'restaurado'))
    assert.ok((await readdir(space.restores)).includes('restaurado'))
  })
})

test('AC-14: referência ausente gera Verificado com avisos, sem correção automática', async () => {
  const space = await workspace()
  const archive = await exportFrom(space, { missingTag: true })
  const report = await restoreBackup(archive, restoreOptions(space))
  assert.equal(report.state, 'verified-with-warnings')
  assert.equal(report.canOpen, true)
  assert.deepEqual(report.warnings.map((entry) => [entry.code, entry.path]), [['missing-reference', `items/${ids.item}.md`]])
  const destination = join(space.restores, 'restaurado')
  assert.deepEqual(await readFile(join(destination, 'items', `${ids.item}.md`)), await readFile(join(space.vault, 'items', `${ids.item}.md`)))
})

test('AC-15: diário antes de cada item; interrupção detectada no reinício sem oferecer abertura', async (context) => {
  await context.test('fim do processo simulado durante a extração', async () => {
    const space = await workspace()
    const archive = await exportFrom(space)
    const fs = new CrashingFileSystem(3)
    const report = await restoreBackup(archive, restoreOptions(space, { fs }))
    assert.equal(report.state, 'failed')
    assert.equal(report.canOpen, false)
    const destination = join(space.restores, 'restaurado')

    const intents = new Set<string>()
    for (const event of fs.events) {
      if (event.kind === 'journal' && event.detail?.includes('"type":"intent"')) {
        const entry = JSON.parse(event.detail) as { path: string }
        intents.add(entry.path === '' ? destination : join(destination, ...entry.path.split('/')))
      }
      if (event.kind === 'create' && isUnder(destination, event.path)) assert.ok(intents.has(event.path), `created before journal: ${event.path}`)
    }
    const journalText = fs.events.filter((event) => event.kind === 'journal').map((event) => event.detail).join('')
    assert.equal(journalText.includes(BODY_SECRET), false)

    const restarted = await findIncompleteRestores(space.appData, new BackupFileSystem())
    assert.deepEqual(restarted.map((entry) => [entry.destination, entry.state, entry.canOpen]), [[destination, 'interrupted', false]])
  })

  await context.test('cancelamento durante o progresso termina como Interrompido', async () => {
    const space = await workspace()
    const archive = await exportFrom(space)
    const report = await restoreBackup(archive, restoreOptions(space, { hooks: { afterFileWritten: (_path, index) => (index === 0 ? 'cancel' : 'continue') } }))
    assert.equal(report.state, 'interrupted')
    assert.equal(report.canOpen, false)
    assert.equal(report.counts.verified, 1)
    assert.deepEqual((await findIncompleteRestores(space.appData)).map((entry) => entry.state), ['interrupted'])
  })
})

async function failedRestore(space: Workspace): Promise<{ report: RestoreReport; destination: string }> {
  const archive = await exportFrom(space)
  const report = await restoreBackup(archive, restoreOptions(space, { fs: new CrashingFileSystem(3) }))
  assert.equal(report.state, 'failed')
  return { report, destination: join(space.restores, 'restaurado') }
}

test('AC-16: remover cópia incompleta apaga só o que o diário registrou, de baixo para cima', async (context) => {
  await context.test('com arquivo estranho: estranho e sentinela preservados, pasta mantida, marcador presente', async () => {
    const space = await workspace()
    const { report, destination } = await failedRestore(space)
    await writeFile(join(destination, 'assets', 'estranho.txt'), 'não registrado')
    const strangerHash = sha256(await readFile(join(destination, 'assets', 'estranho.txt')))
    const sentinelBefore = await snapshot(space.sentinel)
    const activeBefore = await snapshot(space.vault)

    const result = await resolveIncompleteRestore(space.appData, report.restoreId, 'remove', { now: () => NOW })
    assert.ok(result.removed.length > 0)
    assert.equal(result.destinationExists, true)
    assert.deepEqual(result.preserved, ['assets', 'assets/estranho.txt'])
    assert.equal(sha256(await readFile(join(destination, 'assets', 'estranho.txt'))), strangerHash)
    assert.deepEqual(await snapshot(space.sentinel), sentinelBefore)
    assert.deepEqual(await snapshot(space.vault), activeBefore)
    assert.deepEqual(await findIncompleteRestores(space.appData), [])
    assert.equal((await unverifiedCopyMarkerFor(space.appData, destination))?.status, 'não verificado')
  })

  await context.test('sem arquivo estranho: tudo removido, inclusive a pasta, sem marcador', async () => {
    const space = await workspace()
    const { report, destination } = await failedRestore(space)
    const result = await resolveIncompleteRestore(space.appData, report.restoreId, 'remove', { now: () => NOW })
    assert.equal(result.destinationExists, false)
    assert.ok(result.removed.includes('.'))
    assert.deepEqual(await readdir(space.restores), [])
    assert.equal(result.marker, undefined)
    assert.equal(await unverifiedCopyMarkerFor(space.appData, destination), null)
    assert.deepEqual(await findIncompleteRestores(space.appData), [])
  })
})

test('AC-17 (dados): manter para diagnóstico preserva a cópia e o marcador até a dispensa', async () => {
  const space = await workspace()
  const { report, destination } = await failedRestore(space)
  const before = await snapshot(destination)
  const result = await resolveIncompleteRestore(space.appData, report.restoreId, 'keep', { now: () => NOW })
  assert.deepEqual(await snapshot(destination), before)
  assert.equal(result.destinationExists, true)
  assert.deepEqual(await findIncompleteRestores(space.appData), [])
  const marker = await unverifiedCopyMarkerFor(space.appData, destination)
  assert.deepEqual(marker, { restore_id: report.restoreId, destination, status: 'não verificado', date: NOW.toISOString(), archive_sha256: report.backup.sha256 })
  assert.equal(await unverifiedCopyMarkerFor(space.appData, space.vault), null)
  await dismissUnverifiedCopy(space.appData, report.restoreId)
  assert.equal(await unverifiedCopyMarkerFor(space.appData, destination), null)
  assert.deepEqual(await snapshot(destination), before)
})
