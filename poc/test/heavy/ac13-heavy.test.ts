import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { generateFixture } from '../../bench/ac19-fixture.js'
import { exportBackup } from '../../src/backup/export.js'
import { restoreBackup } from '../../src/backup/restore.js'
import { listEntries, openArchive } from '../../src/backup/verify-archive.js'
import { readZipStructure } from '../zip-structure.js'

// Fora do glob de npm test. Executar explicitamente com ATLAS_AC13_HEAVY=1.
const heavy = { skip: process.env.ATLAS_AC13_HEAVY !== '1' ? 'defina ATLAS_AC13_HEAVY=1; usa mais de 8 GiB de disco' : false }
const NOW = new Date('2026-10-18T12:00:00.000Z')

async function workspace(context: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'atlas-ac13-heavy-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const space = { vault: join(root, 'vault'), out: join(root, 'out'), restores: join(root, 'restores'), appData: join(root, 'app-data') }
  await mkdir(space.out)
  await mkdir(space.restores)
  return space
}

async function digest(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

test('AC-13 real: mais de 65.535 entradas promovem automaticamente para ZIP64 e restauram', heavy, async (context) => {
  const space = await workspace(context)
  const started = performance.now()
  await generateFixture(space.vault, { series: 'ii', step: 65_536 })
  context.diagnostic('fixture: 65.536 anexos de 4 KiB, Tag e settings.yml; semente atlas-ac19-v1')
  const result = await exportBackup(space.vault, join(space.out, 'entries.zip'), { decide: () => ({ nonCanonical: {} }), now: () => NOW })
  const structure = await readZipStructure(result.archivePath)
  assert.ok(structure.zip64)
  assert.equal(structure.zip64.entries, 65_539n)
  assert.equal(structure.eocdEntries, 0xffff)
  assert.equal(structure.centralEntries.length, 65_539)
  assert.ok(structure.centralEntries.every((entry) => !entry.hasZip64Extra), 'arquivos pequenos não precisam de extra ZIP64 por entrada')
  const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW })
  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
  assert.deepEqual(report.counts, { expected: 65_538, extracted: 65_538, verified: 65_538 })
  // A restauração calcula o SHA-256 de cada arquivo durante a extração, contra o manifesto relido.
  assert.equal(await digest(join(space.vault, 'assets/serie-ii/p0/f0.bin')), await digest(join(space.restores, 'r/assets/serie-ii/p0/f0.bin')))
  context.diagnostic(JSON.stringify({ entries: String(structure.zip64.entries), counts: report.counts, manifestSha256: createHash('sha256').update(JSON.stringify(result.manifest.files)).digest('hex'), elapsedMs: performance.now() - started, maxRssKiB: process.resourceUsage().maxRSS }))
})

test('AC-13 real: arquivo acima de 4 GiB promove tamanho e offsets para ZIP64 e restaura', heavy, async (context) => {
  const space = await workspace(context)
  const started = performance.now()
  await generateFixture(space.vault, { series: 'ii', step: 0 })
  await mkdir(join(space.vault, 'assets'))
  const largePath = join(space.vault, 'assets/large.bin')
  const size = 2 ** 32 + 1
  const handle = await open(largePath, 'wx')
  try { await handle.truncate(size) } finally { await handle.close() }
  context.diagnostic(`fixture: anexo esparso de ${size} bytes; ZIP e restauração gravam os bytes reais em streaming`)
  const result = await exportBackup(space.vault, join(space.out, 'large.zip'), { decide: () => ({ nonCanonical: {} }), now: () => NOW })
  const structure = await readZipStructure(result.archivePath)
  assert.ok(structure.zip64)
  assert.equal(structure.zip64.entries, 4n)
  assert.ok(structure.zip64.centralOffset > 0xffffffffn)
  assert.equal(structure.eocdCentralOffset, 0xffffffff)
  const large = structure.centralEntries.find((entry) => entry.name === 'assets/large.bin')!
  assert.equal(large.compressedField, 0xffffffff)
  assert.equal(large.uncompressedField, 0xffffffff)
  assert.equal(large.hasZip64Extra, true)
  const archive = await openArchive(result.archivePath)
  try {
    const entry = (await listEntries(archive)).find((entry) => entry.fileName === 'assets/large.bin')!
    assert.equal(entry.uncompressedSize, size)
    assert.equal(entry.compressedSize, size)
  } finally { archive.close() }
  const report = await restoreBackup(result.archivePath, { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW })
  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
  assert.deepEqual(report.counts, { expected: 3, extracted: 3, verified: 3 })
  const expected = result.manifest.files.find((file) => file.path === 'assets/large.bin')!
  const restoredSha256 = await digest(join(space.restores, 'r/assets/large.bin'))
  assert.equal(restoredSha256, expected.sha256)
  context.diagnostic(JSON.stringify({ bytes: size, sha256: restoredSha256, centralOffset: String(structure.zip64.centralOffset), counts: report.counts, elapsedMs: performance.now() - started, maxRssKiB: process.resourceUsage().maxRSS }))
})
