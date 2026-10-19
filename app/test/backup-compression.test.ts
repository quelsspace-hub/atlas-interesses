import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ZipFile } from 'yazl'
import { checkCompressionRatio, validateCompressionLimit } from '../src/vault/backup/compression.js'
import { BackupVerificationError } from '../src/vault/backup/errors.js'
import { exportBackup } from '../src/vault/backup/export.js'
import { restoreBackup } from '../src/vault/backup/restore.js'
import { verifyBackupArchive, openArchive, listEntries } from '../src/vault/backup/verify-archive.js'
import { buildManifest, serializeManifest } from '../src/vault/backup/manifest.js'
import { createHash } from 'node:crypto'

const MiB = 1024 * 1024
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

const rejectedRatio = (error: unknown) => error instanceof BackupVerificationError && error.diagnostics.some((d) => d.code === 'compression-ratio-exceeded')

test('S-1: limite inclusivo, tamanho zero e aritmética exata ZIP64', () => {
  checkCompressionRatio('a', 128 * 123, 123, 128)
  assert.throws(() => checkCompressionRatio('a', 128 * 123 + 1, 123, 128), rejectedRatio)
  checkCompressionRatio('empty', 0, 0, 128)
  assert.throws(() => checkCompressionRatio('a', 1, 0, 128), rejectedRatio)
  // Produto ultrapassa MAX_SAFE_INTEGER, mas a comparação BigInt continua exata.
  checkCompressionRatio('zip64', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 128)
  assert.throws(() => checkCompressionRatio('zip64', Number.MAX_SAFE_INTEGER, 1, 128), rejectedRatio)
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateCompressionLimit(value), RangeError)
})

async function archive(path: string, manifestCompressed = false, compressData = true, forced = false): Promise<void> {
  const data = Buffer.alloc(MiB)
  const manifest = serializeManifest(buildManifest([{ path: 'assets/zeros.bin', size: data.length, sha256: sha256(data) }], new Date('2026-10-19T00:00:00Z')))
  const zip = new ZipFile()
  const chunks: Buffer[] = []
  const done = new Promise<void>((resolve, reject) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.once('end', resolve)
    zip.outputStream.once('error', reject)
    zip.once('error', reject)
  })
  zip.addBuffer(data, 'assets/zeros.bin', { compress: compressData, forceZip64Format: forced })
  // Espaços JSON válidos produzem manifesto muito comprimível, ainda abaixo do teto S-3.
  const text = manifestCompressed ? Buffer.concat([manifest, Buffer.alloc(5000, 32)]) : manifest
  zip.addBuffer(text, 'manifest.json', { compress: manifestCompressed, forceZip64Format: forced })
  zip.end({ forceZip64Format: forced, comment: '' })
  await done
  await writeFile(path, Buffer.concat(chunks))
}

test('S-1: recusa arquivo clássico/ZIP64 e manifesto antes de confirmação/escrita', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-s1-reject-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [label, manifestCompressed, compressData, forced] of [
    ['classic', false, true, false], ['zip64', false, true, true], ['manifest', true, false, false]
  ] as const) await t.test(label, async () => {
    const path = join(root, `${label}.zip`)
    await archive(path, manifestCompressed, compressData, forced)
    const limit = manifestCompressed ? 4 : 128
    await assert.rejects(verifyBackupArchive(path, { maxCompressionRatio: limit }), rejectedRatio)
    let confirmations = 0
    const report = await restoreBackup(path, { maxCompressionRatio: limit, parentDirectory: root, folderName: `restore-${label}`, appDataDirectory: join(root, 'app'), confirm: () => { confirmations++; return true } })
    assert.equal(report.state, 'failed')
    assert.equal(report.canOpen, false)
    assert.equal(report.destinationCreated, false)
    assert.equal(confirmations, 0)
    assert.ok(report.errors.some((e) => e.code === 'compression-ratio-exceeded' && e.stage === 'pre-validation'))
    await assert.rejects(readFile(join(root, `restore-${label}`, 'assets/zeros.bin')), { code: 'ENOENT' })
  })
})

test('S-1: exportação store restaura conteúdo altamente comprimível sem perda', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-s1-store-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'vault')
  await mkdir(join(vault, 'assets'), { recursive: true })
  const bytes = Buffer.alloc(MiB)
  await writeFile(join(vault, 'assets/zeros.bin'), bytes)
  const path = join(root, 'backup.zip')
  await exportBackup(vault, path, { maxCompressionRatio: 128, decide: () => ({ nonCanonical: {} }) })
  const zip = await openArchive(path)
  try { assert.ok((await listEntries(zip)).every((e) => e.compressionMethod === 0)) } finally { zip.close() }
  const report = await restoreBackup(path, { maxCompressionRatio: 128, parentDirectory: root, folderName: 'restored', appDataDirectory: join(root, 'app'), confirm: () => true })
  assert.equal(report.state, 'verified')
  assert.deepEqual(await readFile(join(root, 'restored/assets/zeros.bin')), bytes)
})

test('S-1: configuração inválida falha antes de ler ZIP ou criar destino', async () => {
  const report = await restoreBackup('/absent.zip', { maxCompressionRatio: NaN, parentDirectory: '/absent', folderName: 'restore', appDataDirectory: '/absent', confirm: () => { throw new Error('must not confirm') } })
  assert.equal(report.state, 'failed')
  assert.equal(report.destinationCreated, false)
  assert.equal(report.errors[0].code, 'invalid-compression-limit')
  await assert.rejects(verifyBackupArchive('/absent.zip', { maxCompressionRatio: Infinity }), RangeError)
})


test('S-1: deflate abaixo do limite é aceito e política fica estável durante callbacks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-s1-allowed-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const path = join(root, 'compressed.zip')
  await archive(path)
  const options = { maxCompressionRatio: 2048, parentDirectory: root, folderName: 'restored', appDataDirectory: join(root, 'app'), confirm: () => { options.maxCompressionRatio = 1; return true } }
  const report = await restoreBackup(path, options)
  assert.equal(report.state, 'verified')
  assert.equal(sha256(await readFile(join(root, 'restored/assets/zeros.bin'))), sha256(Buffer.alloc(MiB)))
})
