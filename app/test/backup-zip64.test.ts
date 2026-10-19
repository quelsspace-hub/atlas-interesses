import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { BackupFileSystem } from '../src/vault/backup/backup-fs.js'
import { BackupWriteError } from '../src/vault/backup/errors.js'
import { exportBackup } from '../src/vault/backup/export.js'
import { restoreBackup } from '../src/vault/backup/restore.js'
import { verifyBackupArchive } from '../src/vault/backup/verify-archive.js'
import { readZipStructure } from './zip-structure.js'

// AC-13 (parte automática e leve): ZIP64 forçado pela biblioteca e formato clássico quando não é necessário (Z-B).
// Os casos reais acima de 65.535 entradas e de 4 GiB estão em test/heavy/ac13-heavy.test.ts, fora de `npm test`.
const NOW = new Date('2026-10-18T12:00:00.000Z')
const TAG_ID = '22222222-2222-4222-8222-222222222222'

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function vault(context: TestContext): Promise<{ root: string; vault: string; out: string; restores: string; appData: string }> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-zip64-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const space = { root, vault: join(root, 'vault'), out: join(root, 'out'), restores: join(root, 'restores'), appData: join(root, 'app-data') }
  for (const path of [space.out, space.restores]) await mkdir(path)
  await mkdir(join(space.vault, 'tags'), { recursive: true })
  await writeFile(join(space.vault, 'tags', `${TAG_ID}.md`), `---\nid: ${TAG_ID}\nschema_version: 1\ntitle: Base\n---\nTag.\n`)
  await mkdir(join(space.vault, 'assets', 'sub'), { recursive: true })
  await writeFile(join(space.vault, 'assets', 'sub', 'dados.bin'), Buffer.from(Array.from({ length: 70_000 }, (_, index) => (index * 7) % 256)))
  await writeFile(join(space.vault, 'settings.yml'), 'settings_version: 1\n')
  return space
}

const decide = () => ({ nonCanonical: {} })

test('AC-13 (Z-B): backup pequeno usa o formato clássico, sem estruturas ZIP64', async (context) => {
  const space = await vault(context)
  const result = await exportBackup(space.vault, join(space.out, 'classico.zip'), { decide, now: () => NOW })
  const structure = await readZipStructure(result.archivePath)
  assert.equal(structure.zip64, null)
  assert.equal(structure.eocdEntries, 4)
  assert.equal(structure.centralEntries.length, 4)
  assert.ok(structure.centralEntries.every((entry) => !entry.hasZip64Extra))
})

test('AC-13: ZIP64 forçado é gravado, relido e restaurado com bytes idênticos', async (context) => {
  const space = await vault(context)
  const result = await exportBackup(space.vault, join(space.out, 'zip64.zip'), { decide, now: () => NOW, forceZip64: true })
  const structure = await readZipStructure(result.archivePath)
  assert.ok(structure.zip64, 'ZIP64 end of central directory record and locator present')
  assert.equal(structure.zip64.entries, 4n)
  assert.equal(structure.eocdEntries, 0xffff)
  assert.equal(structure.eocdCentralSize, 0xffffffff)
  assert.equal(structure.eocdCentralOffset, 0xffffffff)
  assert.deepEqual(structure.centralEntries.map((entry) => entry.name).sort(), ['assets/sub/dados.bin', 'manifest.json', `tags/${TAG_ID}.md`, 'settings.yml'].sort())
  assert.ok(structure.centralEntries.every((entry) => entry.hasZip64Extra), 'every central directory record carries the ZIP64 extra field')
  assert.ok(structure.centralEntries.every((entry) => entry.compressedField === 0xffffffff && entry.uncompressedField === 0xffffffff && entry.localOffsetField === 0xffffffff))

  const manifest = await verifyBackupArchive(result.archivePath)
  assert.deepEqual(manifest, result.manifest)

  const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW })
  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
  for (const file of result.manifest.files) {
    const restored = await readFile(join(space.restores, 'r', ...file.path.split('/')))
    assert.deepEqual(restored, await readFile(join(space.vault, ...file.path.split('/'))), file.path)
    assert.equal(sha256(restored), file.sha256, file.path)
  }
})

test('AC-13: ZIP64 forçado adulterado continua recusado pela pré-validação', async (context) => {
  const space = await vault(context)
  const result = await exportBackup(space.vault, join(space.out, 'zip64.zip'), { decide, now: () => NOW, forceZip64: true })
  const original = await readFile(result.archivePath)
  const locator = original.length - 22 - 20
  assert.equal(original.readUInt32LE(locator), 0x07064b50)
  const variants: Array<[string, (bytes: Buffer) => void, string]> = [
    ['conteúdo alterado', (bytes) => {
      const marker = bytes.indexOf(Buffer.from('settings_version: 1'))
      assert.ok(marker > 0)
      bytes[marker + 'settings_version: '.length] = '2'.charCodeAt(0)
    }, 'hash-mismatch'],
    ['localizador fora do arquivo', (bytes) => bytes.writeBigUInt64LE(BigInt(bytes.length), locator + 8), 'invalid-archive'],
    ['registro final ZIP64 ausente', (bytes) => bytes.writeUInt32LE(0, Number(bytes.readBigUInt64LE(locator + 8))), 'invalid-archive']
  ]
  for (const [name, mutate, code] of variants) {
    await context.test(name, async () => {
      const bytes = Buffer.from(original)
      mutate(bytes)
      await writeFile(result.archivePath, bytes)
      let confirmations = 0
      const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => { confirmations += 1; return true }, now: () => NOW })
      assert.equal(report.state, 'failed')
      assert.equal(report.canOpen, false)
      assert.equal(report.destinationCreated, false)
      assert.equal(confirmations, 0)
      assert.deepEqual(report.errors.map((entry) => [entry.code, entry.stage]), [[code, 'pre-validation']])
      assert.deepEqual(await readdir(space.restores), [])
      assert.deepEqual((await readdir(space.root)).sort(), ['out', 'restores', 'vault'])
      for (const file of result.manifest.files) assert.equal(sha256(await readFile(join(space.vault, ...file.path.split('/')))), file.sha256)
    })
  }
})

test('ZIP64: permissão negada na exportação ou restauração não apresenta sucesso', async (context) => {
  for (const code of ['EACCES', 'EPERM']) {
    await context.test(code, async (subcontext) => {
      const space = await vault(subcontext)
      const denied = () => Object.assign(new Error(`synthetic ${code}`), { code })
      class DeniedExport extends BackupFileSystem {
        override async openExclusive(): Promise<never> { throw denied() }
      }
      await assert.rejects(exportBackup(space.vault, join(space.out, 'denied.zip'), { decide, forceZip64: true, fs: new DeniedExport() }), (error: unknown) => {
        assert.ok(error instanceof BackupWriteError)
        assert.equal(error.stage, 'create-temporary')
        assert.equal((error.cause as NodeJS.ErrnoException).code, code)
        return true
      })
      assert.deepEqual(await readdir(space.out), [])
      const result = await exportBackup(space.vault, join(space.out, 'zip64.zip'), { decide, forceZip64: true })
      class DeniedRestore extends BackupFileSystem {
        override async mkdirExclusive(): Promise<never> { throw denied() }
      }
      const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, fs: new DeniedRestore() })
      assert.equal(report.state, 'failed')
      assert.equal(report.canOpen, false)
      assert.equal(report.destinationCreated, false)
      assert.ok(report.errors.some((entry) => entry.code === 'create-failed' && entry.message.includes(code)))
      assert.deepEqual(await readdir(space.restores), [])
      for (const file of result.manifest.files) assert.equal(sha256(await readFile(join(space.vault, ...file.path.split('/')))), file.sha256)
    })
  }
})
