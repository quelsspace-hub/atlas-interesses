import { createHash, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import {
  DestinationExistsError,
  FrontmatterDiagnosticError,
  RecordValidationError,
  StorageFailureError,
  TemporaryWriteError,
  UncertainWriteError,
  WriteConflictError
} from './errors.js'
import { parseFrontmatterDocument } from './frontmatter.js'
import type { StoragePort } from './storage-port.js'

// Origem: poc/src/core/record.ts (protocolo verificado na PoC). No aplicativo a validação de campos
// fica na camada de domínio (src/domain/validate.ts); aqui só a sintaxe do frontmatter é exigida, e
// a gravação recebe os bytes completos (metadados + corpo), servindo tanto à edição só de YAML (D-006,
// corpo original anexado por quem chama) quanto à edição explícita do corpo.
export interface RecordSnapshot {
  path: string
  metadata: Record<string, unknown>
  body: Buffer
  bytes: Buffer
  revision: string
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function snapshotOf(path: string, bytes: Buffer): RecordSnapshot {
  const parsed = parseFrontmatterDocument(bytes)
  const stableBytes = Buffer.from(bytes)
  return { path, metadata: parsed.metadata, body: parsed.body, bytes: stableBytes, revision: sha256(stableBytes) }
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function removeTemporary(storage: StoragePort, tempPath: string): Promise<unknown | undefined> {
  try {
    await storage.remove(tempPath)
    return undefined
  } catch (error) {
    return error
  }
}

export async function readRecord(path: string, storage: StoragePort): Promise<RecordSnapshot> {
  let bytes: Buffer
  try {
    bytes = await storage.readFile(path)
  } catch (error) {
    throw new StorageFailureError('read', path, Buffer.alloc(0), error)
  }
  return snapshotOf(path, bytes)
}

export async function createRecord(path: string, bytes: Buffer, storage: StoragePort): Promise<RecordSnapshot> {
  parseFrontmatterDocument(bytes)

  try {
    await storage.createExclusive(path, bytes)
  } catch (error) {
    if (isErrno(error, 'EEXIST')) throw new DestinationExistsError(path)

    try {
      const observed = await storage.readFile(path)
      if (observed.equals(bytes)) return snapshotOf(path, observed)
      throw new UncertainWriteError(path, sha256(bytes), Buffer.from(bytes), error, observed)
    } catch (verificationError) {
      if (verificationError instanceof UncertainWriteError) throw verificationError
      if (isErrno(verificationError, 'ENOENT')) {
        throw new StorageFailureError('create-exclusive', path, Buffer.from(bytes), error)
      }
      throw new UncertainWriteError(path, sha256(bytes), Buffer.from(bytes), error)
    }
  }

  try {
    const persisted = await storage.readFile(path)
    if (!persisted.equals(bytes)) {
      throw new UncertainWriteError(path, sha256(bytes), Buffer.from(bytes), new Error('Persisted bytes differ'), persisted)
    }
    return snapshotOf(path, persisted)
  } catch (error) {
    if (error instanceof UncertainWriteError) throw error
    throw new UncertainWriteError(path, sha256(bytes), Buffer.from(bytes), error)
  }
}

// Substitui um registro existente pelos bytes `draftBytes`, exigindo que o arquivo ainda tenha a revisão lida.
export async function replaceRecord(original: RecordSnapshot, draftBytes: Buffer, storage: StoragePort): Promise<RecordSnapshot> {
  const draft = parseFrontmatterDocument(draftBytes)
  if (draft.metadata.id !== original.metadata.id) {
    throw new RecordValidationError('id is immutable during edits')
  }

  const tempPath = join(dirname(original.path), `.tmp-${randomUUID()}.md`)
  let observed: Buffer

  try {
    observed = await storage.readFile(original.path)
  } catch (error) {
    throw new StorageFailureError('read-before-save', original.path, draftBytes, error)
  }
  if (sha256(observed) !== original.revision) {
    throw new WriteConflictError(original.path, original.revision, observed, draftBytes)
  }

  try {
    await storage.writeTemporary(tempPath, draftBytes)
  } catch (error) {
    const cleanupError = error instanceof TemporaryWriteError ? error.cleanupError : undefined
    throw new StorageFailureError('write-temporary', original.path, draftBytes, error, tempPath, cleanupError)
  }

  try {
    observed = await storage.readFile(original.path)
  } catch (error) {
    const cleanupError = await removeTemporary(storage, tempPath)
    throw new StorageFailureError('compare-before-rename', original.path, draftBytes, error, tempPath, cleanupError)
  }
  if (sha256(observed) !== original.revision) {
    const cleanupError = await removeTemporary(storage, tempPath)
    throw new WriteConflictError(original.path, original.revision, observed, draftBytes, tempPath, cleanupError)
  }

  try {
    await storage.rename(tempPath, original.path)
  } catch (error) {
    try {
      observed = await storage.readFile(original.path)
    } catch (verificationError) {
      throw new UncertainWriteError(original.path, sha256(draftBytes), draftBytes, verificationError, undefined, tempPath)
    }

    if (observed.equals(draftBytes)) return snapshotOf(original.path, observed)
    if (sha256(observed) === original.revision) {
      throw new StorageFailureError('rename', original.path, draftBytes, error, tempPath)
    }
    throw new UncertainWriteError(original.path, sha256(draftBytes), draftBytes, error, observed, tempPath)
  }

  try {
    observed = await storage.readFile(original.path)
  } catch (error) {
    throw new UncertainWriteError(original.path, sha256(draftBytes), draftBytes, error, undefined, tempPath)
  }
  if (!observed.equals(draftBytes)) {
    throw new UncertainWriteError(original.path, sha256(draftBytes), draftBytes, new Error('Persisted bytes differ from draft'), observed, tempPath)
  }

  return snapshotOf(original.path, observed)
}

export { FrontmatterDiagnosticError }
