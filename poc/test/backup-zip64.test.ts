import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { exportBackup } from '../src/backup/export.js'
import { restoreBackup } from '../src/backup/restore.js'
import { verifyBackupArchive } from '../src/backup/verify-archive.js'
import { readZipStructure } from './zip-structure.js'

// AC-13 (parte automática e leve): ZIP64 forçado pela biblioteca e formato clássico quando não é necessário (Z-B).
// Os casos reais acima de 65.535 entradas e de 4 GiB estão em test/heavy/ac13-heavy.test.ts, fora de `npm test`.
const temporaryDirectories: string[] = []
const NOW = new Date('2026-10-18T12:00:00.000Z')
const TAG_ID = '22222222-2222-4222-8222-222222222222'

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function vault(): Promise<{ root: string; vault: string; out: string; restores: string; appData: string }> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-zip64-'))
  temporaryDirectories.push(root)
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

test('AC-13 (Z-B): backup pequeno usa o formato clássico, sem estruturas ZIP64', async () => {
  const space = await vault()
  const result = await exportBackup(space.vault, join(space.out, 'classico.zip'), { decide, now: () => NOW })
  const structure = await readZipStructure(result.archivePath)
  assert.equal(structure.zip64, null)
  assert.equal(structure.eocdEntries, 4)
  assert.ok(structure.centralEntries.every((entry) => !entry.hasZip64Extra))
})

test('AC-13: ZIP64 forçado é gravado, relido e restaurado com bytes idênticos', async () => {
  const space = await vault()
  const result = await exportBackup(space.vault, join(space.out, 'zip64.zip'), { decide, now: () => NOW, forceZip64: true })
  const structure = await readZipStructure(result.archivePath)
  assert.ok(structure.zip64, 'ZIP64 end of central directory record and locator present')
  assert.equal(structure.zip64.entries, 4n)
  assert.deepEqual(structure.centralEntries.map((entry) => entry.name).sort(), ['assets/sub/dados.bin', 'manifest.json', `tags/${TAG_ID}.md`, 'settings.yml'].sort())
  assert.ok(structure.centralEntries.every((entry) => entry.hasZip64Extra), 'every central directory record carries the ZIP64 extra field')

  const manifest = await verifyBackupArchive(result.archivePath)
  assert.deepEqual(manifest, result.manifest)

  const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW })
  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
  for (const file of result.manifest.files) {
    const restored = await readFile(join(space.restores, 'r', ...file.path.split('/')))
    assert.equal(sha256(restored), file.sha256, file.path)
  }
})

test('AC-13: ZIP64 forçado adulterado continua recusado pela pré-validação', async () => {
  const space = await vault()
  const result = await exportBackup(space.vault, join(space.out, 'zip64.zip'), { decide, now: () => NOW, forceZip64: true })
  const bytes = await readFile(result.archivePath)
  const marker = bytes.indexOf(Buffer.from('settings_version: 1'))
  assert.ok(marker > 0)
  bytes[marker + 'settings_version: '.length] = '2'.charCodeAt(0)
  await writeFile(result.archivePath, bytes)
  const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW })
  assert.equal(report.state, 'failed')
  assert.deepEqual(report.errors.map((entry) => [entry.code, entry.stage]), [['hash-mismatch', 'pre-validation']])
})
