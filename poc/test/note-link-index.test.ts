import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import { encodeRecordBytes, parseRecordBytes, type RecordMetadata } from '../src/core/frontmatter.js'
import {
  rebuildNoteLinkIndex,
  renameNoteTitle,
  type ExperimentalNoteDirectories,
  type NoteLinkDiagnosticCode
} from '../src/core/note-link-index.js'
import { NodeFileStorage } from '../src/adapters/node-storage.js'

const temporaryDirectories: string[] = []
const sourceId = '11111111-1111-4111-8111-111111111111'
const destinationId = '22222222-2222-4222-8222-222222222222'
const duplicateTitleId = '33333333-3333-4333-8333-333333333333'
const missingId = '44444444-4444-4444-8444-444444444444'

class TrackingStorage extends NodeFileStorage {
  readonly reads: string[] = []
  readonly pathChecks: string[] = []

  override readFile(path: string): Promise<Buffer> {
    this.reads.push(resolve(path))
    return super.readFile(path)
  }

  override pathKind(path: string) {
    this.pathChecks.push(resolve(path))
    return super.pathKind(path)
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function noteBytes(metadata: RecordMetadata, body: Buffer): Buffer {
  return encodeRecordBytes(metadata, body)
}

async function allFiles(root: string): Promise<string[]> {
  const paths: string[] = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) paths.push(path)
    }
  }
  await visit(root)
  return paths.sort()
}

async function snapshotFiles(paths: readonly string[]): Promise<Map<string, { bytes: Buffer; hash: string }>> {
  return new Map(await Promise.all(paths.map(async (path) => {
    const bytes = await readFile(path)
    return [path, { bytes, hash: sha256(bytes) }] as const
  })))
}

async function prepareFixture(): Promise<{
  directories: ExperimentalNoteDirectories
  sourcePath: string
  targetPath: string
  duplicatePath: string
  outsidePath: string
  nonNotePath: string
}> {
  const temp = await mkdtemp(join(tmpdir(), 'atlas-note-links-'))
  temporaryDirectories.push(temp)
  const vaultRoot = join(temp, 'vault')
  const notes = {
    work: join(vaultRoot, 'notes', 'work'),
    reading: join(vaultRoot, 'notes', 'reading'),
    permanent: join(vaultRoot, 'notes', 'permanent')
  }
  const assets = join(vaultRoot, 'assets')
  const items = join(vaultRoot, 'items')
  await Promise.all([...Object.values(notes), assets, items].map((path) => mkdir(path, { recursive: true })))

  const directories: ExperimentalNoteDirectories = { vaultRoot, notes }
  const sourcePath = join(notes.reading, `${sourceId}.md`)
  const targetPath = join(notes.permanent, `${destinationId}.md`)
  const duplicatePath = join(notes.permanent, `${duplicateTitleId}.md`)
  const nonNotePath = join(items, 'not-a-note.md')
  const outsidePath = join(temp, 'outside-note.md')

  const sourceBody = Buffer.from([
    '# Fonte de leitura',
    '',
    `[Destino](../permanent/${destinationId}.md#resumo)`,
    `[Mesmo título, outro UUID](../permanent/${duplicateTitleId}.md)`,
    '`[Código inline](../permanent/not-a-note.md)`',
    '',
    '```md',
    '[Código cercado](../permanent/not-a-note.md)',
    '```',
    '[Externo](https://example.test/article)',
    '[Âncora](#local)',
    '[Destino vazio]()',
    `[Query local](../permanent/${destinationId}.md?mode=print)`,
    '[PDF](../../assets/manual.pdf)',
    '[Markdown fora de Notes](../../items/not-a-note.md)',
    `[Ausente](../permanent/${missingId}.md)`,
    '[Fora do vault](../../../outside-note.md)',
    '![Imagem](../../assets/manual.pdf)',
    '[Por referência][canonical]',
    '',
    `[canonical]: ../permanent/${destinationId}.md`,
    ''
  ].join('\n'), 'utf8')
  const source: RecordMetadata = {
    id: sourceId,
    title: 'Fonte',
    note_type: 'reading',
    context_item_id: null,
    tag_ids: []
  }
  const target: RecordMetadata = {
    id: destinationId,
    title: 'Título duplicado',
    note_type: 'permanent',
    context_item_id: null,
    tag_ids: []
  }
  const duplicate: RecordMetadata = {
    ...target,
    id: duplicateTitleId
  }

  await Promise.all([
    writeFile(sourcePath, noteBytes(source, sourceBody)),
    writeFile(targetPath, noteBytes(target, Buffer.from('# Destino\n', 'utf8'))),
    writeFile(duplicatePath, noteBytes(duplicate, Buffer.from('# Outro destino\n', 'utf8'))),
    writeFile(join(assets, 'manual.pdf'), Buffer.from('not a real PDF; synthetic fixture')),
    writeFile(nonNotePath, Buffer.from('Markdown file, not a Note entity')),
    writeFile(outsidePath, Buffer.from('outside vault; must never be read'))
  ])

  return { directories, sourcePath, targetPath, duplicatePath, outsidePath, nonNotePath }
}

test('extrai links CommonMark, resolve UUIDs e classifica destinos não relacionais', async () => {
  const fixture = await prepareFixture()
  const storage = new TrackingStorage()
  const paths = await allFiles(fixture.directories.vaultRoot)
  const before = await snapshotFiles([...paths, fixture.outsidePath])
  const sourceBytes = before.get(fixture.sourcePath)?.bytes
  const index = await rebuildNoteLinkIndex(fixture.directories, storage)

  assert.equal(index.notesById.size, 3)
  assert.equal(index.notesById.get(destinationId)?.title, 'Título duplicado')
  assert.equal(index.notesById.get(duplicateTitleId)?.title, 'Título duplicado')
  assert.notEqual(destinationId, duplicateTitleId)
  assert.notEqual(index.notesById.get(destinationId)?.path, index.notesById.get(duplicateTitleId)?.path)

  const outgoing = index.outgoingByNoteId.get(sourceId) ?? []
  assert.deepEqual(outgoing.map((link) => link.targetNoteId), [destinationId, duplicateTitleId, destinationId])
  assert.equal(outgoing[0].fragment, 'resumo')
  assert.deepEqual(index.backlinksByNoteId.get(destinationId), [sourceId])
  assert.deepEqual(index.backlinksByNoteId.get(duplicateTitleId), [sourceId])
  assert.deepEqual(index.backlinksByNoteId.get(sourceId), [])

  const diagnosticCodes = index.diagnostics.map((entry) => entry.code)
  for (const expected of [
    'external-link',
    'anchor-only',
    'query-not-supported',
    'non-note-target',
    'missing-note',
    'outside-vault',
    'invalid-target',
    'image-excluded'
  ] satisfies NoteLinkDiagnosticCode[]) {
    assert.ok(diagnosticCodes.includes(expected), `missing ${expected} diagnostic`)
  }
  assert.equal(outgoing.some((link) => link.href.includes('not-a-note')), false)
  assert.equal(outgoing.some((link) => link.href.includes('example.test')), false)
  assert.equal(index.diagnostics.some((entry) => entry.href === '../permanent/not-a-note.md'), false)
  assert.ok(sourceBytes)
  assert.deepEqual(await readFile(fixture.sourcePath), sourceBytes)
  assert.equal(storage.reads.includes(resolve(fixture.outsidePath)), false)
  assert.equal(storage.pathChecks.includes(resolve(fixture.outsidePath)), false)

  const after = await snapshotFiles([...paths, fixture.outsidePath])
  for (const path of [...paths, fixture.outsidePath]) {
    assert.deepEqual(after.get(path)?.bytes, before.get(path)?.bytes)
    assert.equal(after.get(path)?.hash, before.get(path)?.hash)
  }
})

test('renomear destino preserva corpo e consumidor; índice novo reconstrói backlinks', async () => {
  const fixture = await prepareFixture()
  const storage = new TrackingStorage()
  let previousIndex: Awaited<ReturnType<typeof rebuildNoteLinkIndex>> | undefined =
    await rebuildNoteLinkIndex(fixture.directories, storage)
  const previousMaps = {
    notes: previousIndex.notesById,
    outgoing: previousIndex.outgoingByNoteId,
    backlinks: previousIndex.backlinksByNoteId
  }
  const targetBefore = await readFile(fixture.targetPath)
  const parsedTargetBefore = parseRecordBytes(targetBefore)
  const consumerBefore = await readFile(fixture.sourcePath)
  const consumerHash = sha256(consumerBefore)

  const renamed = await renameNoteTitle(fixture.targetPath, 'Novo título', storage)
  previousIndex = undefined
  assert.equal(previousIndex, undefined)
  const targetAfter = await readFile(fixture.targetPath)
  const parsedTargetAfter = parseRecordBytes(targetAfter)
  const consumerAfter = await readFile(fixture.sourcePath)
  const rebuilt = await rebuildNoteLinkIndex(fixture.directories, storage)

  assert.equal(renamed.path, fixture.targetPath)
  assert.equal(renamed.metadata.id, destinationId)
  assert.equal(renamed.metadata.title, 'Novo título')
  assert.equal(parsedTargetAfter.metadata.id, destinationId)
  assert.deepEqual(parsedTargetAfter.body, parsedTargetBefore.body)
  assert.equal(sha256(parsedTargetAfter.body), sha256(parsedTargetBefore.body))
  assert.deepEqual(consumerAfter, consumerBefore)
  assert.equal(sha256(consumerAfter), consumerHash)
  assert.equal(rebuilt.notesById.get(destinationId)?.title, 'Novo título')
  assert.equal(rebuilt.notesById.get(duplicateTitleId)?.title, 'Título duplicado')
  assert.deepEqual(rebuilt.outgoingByNoteId.get(sourceId)?.map((link) => link.targetNoteId), [
    destinationId,
    duplicateTitleId,
    destinationId
  ])
  assert.deepEqual(rebuilt.backlinksByNoteId.get(destinationId), [sourceId])
  assert.deepEqual(rebuilt.backlinksByNoteId.get(duplicateTitleId), [sourceId])
  assert.notStrictEqual(rebuilt.notesById, previousMaps.notes)
  assert.notStrictEqual(rebuilt.outgoingByNoteId, previousMaps.outgoing)
  assert.notStrictEqual(rebuilt.backlinksByNoteId, previousMaps.backlinks)
})

test('rejeita diretório experimental de note_type mapeado para pasta canônica diferente', async () => {
  const fixture = await prepareFixture()
  const storage = new NodeFileStorage()
  const directories: ExperimentalNoteDirectories = {
    ...fixture.directories,
    notes: {
      ...fixture.directories.notes,
      work: fixture.directories.notes.reading
    }
  }

  await assert.rejects(
    rebuildNoteLinkIndex(directories, storage),
    /Experimental note directory must be notes\/work/
  )
})