import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { DestinationExistsError, RecordValidationError, StorageFailureError } from '../src/core/errors.js'
import { encodeRecordBytes, parseRecordBytes, type RecordMetadata } from '../src/core/frontmatter.js'
import { isUuidV4 } from '../src/core/identity.js'
import { rebuildNoteLinkIndex, type ExperimentalNoteDirectories } from '../src/core/note-link-index.js'
import { createPermanentNoteFrom, originLinkText } from '../src/core/permanent-note.js'
import { NodeFileStorage } from '../src/adapters/node-storage.js'

const temporaryDirectories: string[] = []
const storage = new NodeFileStorage()
const itemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const workId = '11111111-1111-4111-8111-111111111111'
const readingId = '22222222-2222-4222-8222-222222222222'
const existingPermanentId = '33333333-3333-4333-8333-333333333333'
const newId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const readingTitle = 'Leitura [rascunho] & notas *UX* (v2)'

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function allFiles(root: string): Promise<string[]> {
  const paths: string[] = []
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else paths.push(path)
    }
  }
  await visit(root)
  return paths.sort()
}

async function snapshotVault(root: string): Promise<Map<string, string>> {
  const paths = await allFiles(root)
  return new Map(await Promise.all(paths.map(async (path) => [path, sha256(await readFile(path))] as const)))
}

async function prepareFixture(): Promise<{
  directories: ExperimentalNoteDirectories
  workPath: string
  readingPath: string
}> {
  const temp = await mkdtemp(join(tmpdir(), 'atlas-permanent-'))
  temporaryDirectories.push(temp)
  const vaultRoot = join(temp, 'vault')
  const notes = {
    work: join(vaultRoot, 'notes', 'work'),
    reading: join(vaultRoot, 'notes', 'reading'),
    permanent: join(vaultRoot, 'notes', 'permanent')
  }
  const items = join(vaultRoot, 'items')
  await Promise.all([...Object.values(notes), items].map((path) => mkdir(path, { recursive: true })))

  const workPath = join(notes.work, `${workId}.md`)
  const readingPath = join(notes.reading, `${readingId}.md`)
  const work: RecordMetadata = {
    id: workId,
    title: 'Observações do fluxo',
    note_type: 'work',
    context_item_id: itemId,
    tag_ids: []
  }
  const reading: RecordMetadata = {
    id: readingId,
    title: readingTitle,
    note_type: 'reading',
    context_item_id: null,
    tag_ids: []
  }
  const existingPermanent: RecordMetadata = {
    id: existingPermanentId,
    title: 'Permanente existente',
    note_type: 'permanent',
    context_item_id: null,
    tag_ids: []
  }
  const workBody = Buffer.from('# Observações\r\n\r\nAção e coração.   \r\n\r\n```md\r\n[exemplo](x.md)\r\n```\r\nsem newline final', 'utf8')

  await Promise.all([
    writeFile(workPath, encodeRecordBytes(work, workBody)),
    writeFile(readingPath, encodeRecordBytes(reading, Buffer.from('# Leitura\n\nTexto da leitura.\n', 'utf8'))),
    writeFile(
      join(notes.permanent, `${existingPermanentId}.md`),
      encodeRecordBytes(existingPermanent, Buffer.from('# Existente\n', 'utf8'))
    ),
    writeFile(
      join(items, `${itemId}.md`),
      encodeRecordBytes({ id: itemId, title: 'Projeto sintético', tag_ids: [] }, Buffer.from('Item.\n', 'utf8'))
    )
  ])

  return { directories: { vaultRoot, notes }, workPath, readingPath }
}

test('cria permanente a partir de work com novo UUID, contexto null e origem intacta', async (context) => {
  const fixture = await prepareFixture()
  const before = await snapshotVault(fixture.directories.vaultRoot)
  const workBytesBefore = await readFile(fixture.workPath)
  const elaboration = '# Ideia permanente\n\nElaboração própria, com acentuação.'

  const created = await createPermanentNoteFrom(
    fixture.directories,
    { sourceNoteId: workId, title: 'Ideia permanente', elaboration },
    storage,
    { generateId: () => newId }
  )
  const expectedPath = join(fixture.directories.notes.permanent, `${newId}.md`)
  const persisted = parseRecordBytes(await readFile(expectedPath))

  assert.equal(created.note.path, expectedPath)
  assert.equal(created.originHref, `../work/${workId}.md`)
  assert.deepEqual(persisted.metadata, {
    id: newId,
    title: 'Ideia permanente',
    note_type: 'permanent',
    context_item_id: null
  })
  assert.notEqual(persisted.metadata.id, workId)
  assert.equal(
    persisted.body.toString('utf8'),
    `${elaboration}\n\nOrigem: [Observações do fluxo](../work/${workId}.md)\n`
  )

  const workBytesAfter = await readFile(fixture.workPath)
  assert.deepEqual(workBytesAfter, workBytesBefore)
  assert.equal(sha256(workBytesAfter), sha256(workBytesBefore))
  assert.equal(parseRecordBytes(workBytesAfter).metadata.note_type, 'work')
  assert.equal(parseRecordBytes(workBytesAfter).metadata.context_item_id, itemId)

  const after = await snapshotVault(fixture.directories.vaultRoot)
  assert.deepEqual([...after.keys()].filter((path) => !before.has(path)), [expectedPath])
  for (const [path, hash] of before) assert.equal(after.get(path), hash, `changed: ${path}`)

  const rebuilt = await rebuildNoteLinkIndex(fixture.directories, new NodeFileStorage())
  assert.equal(rebuilt.notesById.get(newId)?.noteType, 'permanent')
  assert.equal(rebuilt.notesById.get(workId)?.noteType, 'work')
  assert.deepEqual(rebuilt.outgoingByNoteId.get(newId)?.map((link) => link.targetNoteId), [workId])
  assert.deepEqual(rebuilt.backlinksByNoteId.get(workId), [newId])
  assert.deepEqual(rebuilt.outgoingByNoteId.get(workId), [])

  context.diagnostic(JSON.stringify({
    newId,
    originHref: created.originHref,
    sourceSha256: sha256(workBytesAfter),
    backlinksOfSource: rebuilt.backlinksByNoteId.get(workId)
  }))
})

test('cria permanente a partir de reading com UUID aleatório, título escapado e EOL CRLF', async () => {
  const fixture = await prepareFixture()
  const readingBytesBefore = await readFile(fixture.readingPath)
  const elaboration = '# Síntese\r\n\r\nTexto em palavras próprias.\r\n'

  const created = await createPermanentNoteFrom(
    fixture.directories,
    { sourceNoteId: readingId, title: 'Síntese', elaboration },
    storage
  )
  const createdId = created.note.metadata.id
  const persisted = parseRecordBytes(await readFile(created.note.path))

  assert.ok(isUuidV4(createdId))
  assert.ok(![workId, readingId, existingPermanentId].includes(createdId))
  assert.equal(created.note.path, join(fixture.directories.notes.permanent, `${createdId}.md`))
  assert.equal(persisted.metadata.context_item_id, null)
  assert.equal(
    persisted.body.toString('utf8'),
    `${elaboration}\r\nOrigem: [${originLinkText(readingTitle)}](../reading/${readingId}.md)\r\n`
  )
  assert.deepEqual(await readFile(fixture.readingPath), readingBytesBefore)

  const rebuilt = await rebuildNoteLinkIndex(fixture.directories, new NodeFileStorage())
  assert.deepEqual(rebuilt.backlinksByNoteId.get(readingId), [createdId])
  assert.equal(rebuilt.notesById.get(readingId)?.title, readingTitle)
})

test('recusa origem inválida, UUID repetido, título vazio e link de origem não interpretável sem gravar', async () => {
  const fixture = await prepareFixture()
  const before = await snapshotVault(fixture.directories.vaultRoot)
  const attempts: Array<{ name: string; sourceNoteId: string; title: string; elaboration: string; id: string }> = [
    { name: 'origem permanente', sourceNoteId: existingPermanentId, title: 'Nova', elaboration: '', id: newId },
    { name: 'origem inexistente', sourceNoteId: newId, title: 'Nova', elaboration: '', id: newId },
    { name: 'UUID da origem', sourceNoteId: workId, title: 'Nova', elaboration: '', id: workId },
    { name: 'UUID de permanente existente', sourceNoteId: workId, title: 'Nova', elaboration: '', id: existingPermanentId },
    { name: 'id não UUID v4', sourceNoteId: workId, title: 'Nova', elaboration: '', id: 'nova-nota' },
    { name: 'título vazio', sourceNoteId: workId, title: '   ', elaboration: '', id: newId },
    { name: 'fence aberta', sourceNoteId: workId, title: 'Nova', elaboration: '```md\nsem fechar', id: newId }
  ]

  for (const attempt of attempts) {
    await assert.rejects(
      createPermanentNoteFrom(
        fixture.directories,
        { sourceNoteId: attempt.sourceNoteId, title: attempt.title, elaboration: attempt.elaboration },
        storage,
        { generateId: () => attempt.id }
      ),
      RecordValidationError,
      attempt.name
    )
  }

  assert.deepEqual(await snapshotVault(fixture.directories.vaultRoot), before)
})

class ConcurrentCreationStorage extends NodeFileStorage {
  readonly foreignBytes = Buffer.from('arquivo criado por outro processo', 'utf8')

  override async createExclusive(path: string, bytes: Buffer): Promise<void> {
    await writeFile(path, this.foreignBytes)
    return super.createExclusive(path, bytes)
  }
}

class CreateFailureStorage extends NodeFileStorage {
  override async createExclusive(): Promise<void> {
    const error = new Error('synthetic EIO during exclusive create') as NodeJS.ErrnoException
    error.code = 'EIO'
    throw error
  }
}

test('colisão concorrente no destino não sobrescreve e falha de escrita não informa sucesso', async () => {
  const fixture = await prepareFixture()
  const workBytesBefore = await readFile(fixture.workPath)
  const destination = join(fixture.directories.notes.permanent, `${newId}.md`)
  const concurrent = new ConcurrentCreationStorage()
  const request = { sourceNoteId: workId, title: 'Nova', elaboration: 'Texto.' }

  await assert.rejects(
    createPermanentNoteFrom(fixture.directories, request, concurrent, { generateId: () => newId }),
    DestinationExistsError
  )
  assert.deepEqual(await readFile(destination), concurrent.foreignBytes)
  assert.deepEqual(await readFile(fixture.workPath), workBytesBefore)

  await rm(destination)
  const before = await snapshotVault(fixture.directories.vaultRoot)
  await assert.rejects(
    createPermanentNoteFrom(fixture.directories, request, new CreateFailureStorage(), { generateId: () => newId }),
    (error: unknown) => {
      assert.ok(error instanceof StorageFailureError)
      assert.equal(error.operation, 'create-exclusive')
      assert.equal(parseRecordBytes(error.draftBytes).metadata.id, newId)
      return true
    }
  )
  assert.deepEqual(await snapshotVault(fixture.directories.vaultRoot), before)
})
