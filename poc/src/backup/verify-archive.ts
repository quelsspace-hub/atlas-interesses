import { createHash } from 'node:crypto'
import type { Readable } from 'node:stream'
import * as yauzl from 'yauzl'
import type { BackupDiagnostic } from './errors.js'
import { BackupVerificationError } from './errors.js'
import { backupPathProblem, collisionKey, manifestProblems, manifestSizeBound, MANIFEST_PATH, pathLimitProblem, type BackupManifest } from './manifest.js'

const ACCEPTED_METHODS = [0, 8]
const UNIX_TYPE_MASK = 0o170000
const UNIX_REGULAR = 0o100000
const UNIX_LINK = 0o120000

export function openArchive(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true }, (error, zipfile) => {
      if (error || !zipfile) reject(error ?? new Error('archive could not be opened'))
      else resolve(zipfile)
    })
  })
}

export function listEntries(zipfile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = []
    zipfile.on('entry', (entry: yauzl.Entry) => {
      entries.push(entry)
      zipfile.readEntry()
    })
    zipfile.once('end', () => resolve(entries))
    zipfile.once('error', reject)
    zipfile.readEntry()
  })
}

export function openEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? new Error('entry could not be read'))
      else resolve(stream)
    })
  })
}

async function digestEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<{ size: number; sha256: string; bytes?: Buffer }> {
  const stream = await openEntry(zipfile, entry)
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of stream) {
    hash.update(chunk as Buffer)
    size += (chunk as Buffer).length
  }
  return { size, sha256: hash.digest('hex') }
}

async function readEntryBytes(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  const stream = await openEntry(zipfile, entry)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

// Pré-validação do ZIP que não depende do destino (VAULT_CONTRACT §7.4 item 5 e §7.7 item 2).
export async function verifyBackupArchive(path: string): Promise<BackupManifest> {
  const diagnostics: BackupDiagnostic[] = []
  const fail = (category: BackupDiagnostic['category'], entryPath: string, code: string, message: string) =>
    diagnostics.push({ category, path: entryPath, code, message })

  let zipfile: yauzl.ZipFile
  try {
    zipfile = await openArchive(path)
  } catch (error) {
    throw new BackupVerificationError([{ category: 'structure', path, code: 'invalid-archive', message: String(error) }])
  }

  try {
    let entries: yauzl.Entry[]
    try {
      entries = await listEntries(zipfile)
    } catch (error) {
      throw new BackupVerificationError([{ category: 'security', path, code: 'invalid-central-directory', message: String(error) }])
    }

    const byName = new Map<string, yauzl.Entry>()
    const keys = new Set<string>()
    for (const entry of entries) {
      const name = entry.fileName
      if (byName.has(name) || keys.has(collisionKey(name))) fail('security', name, 'duplicate-entry', 'duplicate entry name')
      byName.set(name, entry)
      keys.add(collisionKey(name))
      if (name.endsWith('/')) fail('structure', name, 'directory-entry', 'directory entries are not expected')
      const pathProblem = backupPathProblem(name.replace(/\/$/, ''))
      if (pathProblem) fail('security', name, 'unsafe-path', pathProblem)
      const limitProblem = pathLimitProblem(name.replace(/\/$/, ''))
      if (limitProblem) fail('security', name, limitProblem.code, limitProblem.message)
      if (entry.isEncrypted()) fail('security', name, 'encrypted-entry', 'encrypted entries are refused')
      if (!ACCEPTED_METHODS.includes(entry.compressionMethod)) fail('security', name, 'unsupported-method', `method ${entry.compressionMethod}`)
      const unixType = (entry.externalFileAttributes >>> 16) & UNIX_TYPE_MASK
      if (unixType === UNIX_LINK) fail('security', name, 'link-entry', 'link entries are refused (S-A)')
      else if (unixType !== 0 && unixType !== UNIX_REGULAR) fail('security', name, 'unsupported-entry-type', 'entry is not a regular file')
    }
    if (diagnostics.length > 0) throw new BackupVerificationError(diagnostics)

    const manifestEntry = byName.get(MANIFEST_PATH)
    if (!manifestEntry) throw new BackupVerificationError([{ category: 'structure', path: MANIFEST_PATH, code: 'missing-manifest', message: 'manifest.json is missing' }])
    // O manifesto é lido inteiro; o tamanho declarado é conferido antes da leitura (D-015, S-3).
    // validateEntrySizes garante que a leitura não produz mais bytes do que o declarado.
    const bound = manifestSizeBound(entries.length - 1)
    if (manifestEntry.uncompressedSize > bound) {
      throw new BackupVerificationError([{ category: 'security', path: MANIFEST_PATH, code: 'manifest-too-large', message: `manifest declares ${manifestEntry.uncompressedSize} bytes; the bound for ${entries.length - 1} entries is ${bound}` }])
    }
    let manifestValue: unknown
    try {
      manifestValue = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readEntryBytes(zipfile, manifestEntry)))
    } catch (error) {
      throw new BackupVerificationError([{ category: 'structure', path: MANIFEST_PATH, code: 'invalid-manifest', message: String(error) }])
    }
    const problems = manifestProblems(manifestValue)
    if (problems.length > 0) {
      throw new BackupVerificationError(problems.map((message) => ({ category: 'structure' as const, path: MANIFEST_PATH, code: 'invalid-manifest', message })))
    }
    const manifest = manifestValue as BackupManifest

    const declared = new Set(manifest.files.map((file) => file.path))
    for (const name of byName.keys()) {
      if (name !== MANIFEST_PATH && !declared.has(name)) fail('integrity', name, 'undeclared-entry', 'entry is not declared in the manifest')
    }
    for (const file of manifest.files) {
      const entry = byName.get(file.path)
      if (!entry) {
        fail('integrity', file.path, 'missing-entry', 'declared file is missing')
        continue
      }
      if (entry.uncompressedSize !== file.size) fail('integrity', file.path, 'size-mismatch', 'declared size differs from the archive')
      const actual = await digestEntry(zipfile, entry)
      if (actual.size !== file.size) fail('integrity', file.path, 'size-mismatch', 'extracted byte count differs from the manifest')
      if (actual.sha256 !== file.sha256) fail('integrity', file.path, 'hash-mismatch', 'SHA-256 differs from the manifest')
    }
    if (diagnostics.length > 0) throw new BackupVerificationError(diagnostics)
    return manifest
  } finally {
    zipfile.close()
  }
}
