import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile, type FileHandle } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  DestinationExistsError,
  StorageFailureError,
  TemporaryWriteError,
  UncertainWriteError,
  WriteConflictError
} from '../src/core/errors.js'
import { encodeRecordBytes, parseRecordBytes } from '../src/core/frontmatter.js'
import { createRecord, readRecord, saveMetadata } from '../src/core/record.js'
import { NodeFileStorage } from '../src/adapters/node-storage.js'

const fixtureUrl = new URL('../../test/fixtures/group.md', import.meta.url)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function newWorkspace(): Promise<{ directory: string; path: string; storage: NodeFileStorage }> {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-poc-'))
  temporaryDirectories.push(directory)
  return { directory, path: join(directory, 'record.md'), storage: new NodeFileStorage() }
}

async function fixtureWithBody(body: Buffer): Promise<Buffer> {
  const source = parseRecordBytes(await readFile(fixtureUrl))
  return encodeRecordBytes(source.metadata, body)
}

function bodyHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

class ConflictDuringStagingStorage extends NodeFileStorage {
  constructor(private readonly target: string, private readonly externalBytes: Buffer) {
    super()
  }

  override async writeTemporary(path: string, bytes: Buffer): Promise<void> {
    await super.writeTemporary(path, bytes)
    await writeFile(this.target, this.externalBytes)
  }
}

class TemporaryWriteFailureStorage extends NodeFileStorage {
  override async writeTemporary(): Promise<void> {
    const error = new Error('synthetic EIO during temporary write') as NodeJS.ErrnoException
    error.code = 'EIO'
    throw error
  }
}

class ExistingTemporaryPathStorage extends NodeFileStorage {
  tempPath = ''
  readonly externalBytes = Buffer.from('arquivo temporário alheio', 'utf8')

  protected override async openTemporary(path: string): Promise<FileHandle> {
    this.tempPath = path
    await writeFile(path, this.externalBytes)
    return super.openTemporary(path)
  }
}

class PartialTemporaryWriteStorage extends NodeFileStorage {
  protected override async openTemporary(path: string): Promise<FileHandle> {
    await writeFile(path, Buffer.from('partial temporary bytes', 'utf8'))
    return {
      writeFile: async () => {
        const error = new Error('synthetic EIO after partial temporary bytes') as NodeJS.ErrnoException
        error.code = 'EIO'
        throw error
      },
      sync: async () => undefined,
      close: async () => undefined
    } as unknown as FileHandle
  }
}

class RenameFailureStorage extends NodeFileStorage {
  override async rename(): Promise<void> {
    throw new Error('synthetic rename failure before replacement')
  }
}

class UnverifiableRenameStorage extends NodeFileStorage {
  private renamed = false

  override async rename(source: string, destination: string): Promise<void> {
    await super.rename(source, destination)
    this.renamed = true
  }

  override async readFile(path: string): Promise<Buffer> {
    if (this.renamed && path.endsWith('record.md')) throw new Error('synthetic verification read failure')
    return super.readFile(path)
  }
}

test('altera metadados com UUID estável e preserva bytes e SHA-256 do corpo', async (context) => {
  const bodyCases = [
    {
      name: 'LF',
      bytes: Buffer.from('# Notas fictícias\n\nAção e coração.   \n\n```ts\nconst x = 1;\n```\nsem newline final', 'utf8')
    },
    {
      name: 'CRLF',
      bytes: Buffer.from('# Notas fictícias\r\n\r\nAção e coração.   \r\n\r\n```ts\r\nconst x = 1;\r\n```\r\nsem newline final', 'utf8')
    }
  ]

  for (const bodyCase of bodyCases) {
    await context.test(`${bodyCase.name}: corpo idêntico após salvar e reler`, async (subtest) => {
      const workspace = await newWorkspace()
      const originalBytes = await fixtureWithBody(bodyCase.bytes)
      await writeFile(workspace.path, originalBytes)
      const initial = await readRecord(workspace.path, workspace.storage)
      const saved = await saveMetadata(
        initial,
        { ...initial.metadata, title: 'Título alterado' },
        workspace.storage
      )
      const reloaded = await readRecord(workspace.path, workspace.storage)
      const actualBytes = await readFile(workspace.path)
      const beforeHash = bodyHash(initial.body)
      const afterHash = bodyHash(reloaded.body)

      assert.deepEqual(reloaded.body, bodyCase.bytes)
      assert.deepEqual(saved.body, bodyCase.bytes)
      assert.equal(afterHash, beforeHash)
      assert.equal(reloaded.metadata.title, 'Título alterado')
      assert.equal(reloaded.metadata.id, initial.metadata.id)
      assert.equal(reloaded.revision, saved.revision)
      assert.equal(actualBytes.subarray(actualBytes.length - bodyCase.bytes.length).equals(bodyCase.bytes), true)
      subtest.diagnostic(`body-sha256=${beforeHash}`)
    })
  }
})

test('criação exclusiva recusa colisão e conserva os bytes do destino', async () => {
  const workspace = await newWorkspace()
  const existing = Buffer.from('conteúdo externo existente', 'utf8')
  const attempted = await fixtureWithBody(Buffer.from('corpo novo', 'utf8'))
  await writeFile(workspace.path, existing)

  await assert.rejects(createRecord(workspace.path, attempted, workspace.storage), DestinationExistsError)
  assert.deepEqual(await readFile(workspace.path), existing)
  assert.equal(bodyHash(await readFile(workspace.path)), bodyHash(existing))
})

test('detecta alteração externa durante staging e preserva arquivo e rascunho', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)
  const externalBytes = await fixtureWithBody(Buffer.from('edição externa', 'utf8'))
  const storage = new ConflictDuringStagingStorage(workspace.path, externalBytes)

  let conflict: WriteConflictError | undefined
  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Rascunho local' }, storage),
    (error: unknown) => {
      assert.ok(error instanceof WriteConflictError)
      conflict = error
      assert.deepEqual(error.externalBytes, externalBytes)
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Rascunho local')
      assert.equal(error.baseRevision, initial.revision)
      return true
    }
  )
  assert.deepEqual(await readFile(workspace.path), externalBytes)
  assert.ok(conflict?.tempPath)
  await assert.rejects(access(conflict.tempPath))
})

test('falha ao gravar temporário não informa sucesso nem altera o original', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)

  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Rascunho preservado' }, new TemporaryWriteFailureStorage()),
    (error: unknown) => {
      assert.ok(error instanceof StorageFailureError)
      assert.equal(error.operation, 'write-temporary')
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Rascunho preservado')
      return true
    }
  )
  assert.deepEqual(await readFile(workspace.path), originalBytes)
})

test('falha após criar temporário parcial limpa somente o arquivo próprio', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)
  let failure: StorageFailureError | undefined

  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Rascunho parcial' }, new PartialTemporaryWriteStorage()),
    (error: unknown) => {
      assert.ok(error instanceof StorageFailureError)
      failure = error
      assert.equal(error.operation, 'write-temporary')
      assert.ok(error.cause instanceof TemporaryWriteError)
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Rascunho parcial')
      return true
    }
  )

  assert.ok(failure?.tempPath)
  await assert.rejects(access(failure.tempPath))
  assert.deepEqual(await readFile(workspace.path), originalBytes)
})

test('falha EEXIST no temporário preserva o arquivo alheio e o rascunho', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)
  const storage = new ExistingTemporaryPathStorage()

  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Rascunho local' }, storage),
    (error: unknown) => {
      assert.ok(error instanceof StorageFailureError)
      assert.equal(error.operation, 'write-temporary')
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Rascunho local')
      assert.equal(error.tempPath, storage.tempPath)
      return true
    }
  )

  assert.ok(storage.tempPath)
  assert.deepEqual(await readFile(storage.tempPath), storage.externalBytes)
  assert.deepEqual(await readFile(workspace.path), originalBytes)
})

test('falha de rename antes da substituição mantém original e temporário diagnosticável', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)
  let failure: StorageFailureError | undefined

  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Rascunho não aplicado' }, new RenameFailureStorage()),
    (error: unknown) => {
      assert.ok(error instanceof StorageFailureError)
      failure = error
      assert.equal(error.operation, 'rename')
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Rascunho não aplicado')
      return true
    }
  )

  assert.ok(failure?.tempPath)
  assert.deepEqual(await readFile(workspace.path), originalBytes)
  assert.deepEqual(await readFile(failure.tempPath), failure.draftBytes)
})

test('rename seguido de falha na confirmação retorna estado incerto sem rollback', async () => {
  const workspace = await newWorkspace()
  const originalBytes = await fixtureWithBody(Buffer.from('corpo original', 'utf8'))
  await writeFile(workspace.path, originalBytes)
  const initial = await readRecord(workspace.path, workspace.storage)
  const storage = new UnverifiableRenameStorage()

  await assert.rejects(
    saveMetadata(initial, { ...initial.metadata, title: 'Resultado incerto' }, storage),
    (error: unknown) => {
      assert.ok(error instanceof UncertainWriteError)
      assert.equal(error.expectedRevision, bodyHash(error.draftBytes))
      assert.ok(error.tempPath)
      assert.equal(parseRecordBytes(error.draftBytes).metadata.title, 'Resultado incerto')
      assert.equal(error.path, workspace.path)
      return true
    }
  )
  assert.equal(parseRecordBytes(await readFile(workspace.path)).metadata.title, 'Resultado incerto')
})