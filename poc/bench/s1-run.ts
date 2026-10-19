import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateF2, generateExpansion, inspectFixture } from './f2-fixture.js'
import { writeExperimentArchive } from './f2-archive.js'
import { exportBackup } from '../src/backup/export.js'
import { restoreBackup } from '../src/backup/restore.js'
import { listEntries, openArchive } from '../src/backup/verify-archive.js'

// Candidato de laboratório, não valor padrão/contratual do produto.
const candidate = 128
const out = process.argv[2]
if (!out || process.argv.length !== 3) throw new Error('usage: node dist/bench/s1-run.js new-results.jsonl')
await writeFile(out, `${JSON.stringify({ type: 'candidate', maxCompressionRatio: candidate, status: 'proposed', node: process.version, zlib: process.versions.zlib, platform: process.platform })}\n`, { flag: 'wx' })
const work = await mkdtemp(join(tmpdir(), 'atlas-s1-'))
try {
  const f2Root = join(work, 'f2')
  const f2 = await generateF2(f2Root)
  await mkdir(join(work, 'restores'))
  let index = 0
  async function check(archive: string, name: string, shouldReject: boolean, expectedHash?: string): Promise<void> {
    const zip = await openArchive(archive)
    let exceeding: Array<{ path: string; uncompressed: number; compressed: number }>
    try {
      exceeding = (await listEntries(zip)).filter((e) => BigInt(e.uncompressedSize) > BigInt(e.compressedSize) * BigInt(candidate)).map((e) => ({ path: e.fileName, uncompressed: e.uncompressedSize, compressed: e.compressedSize }))
    } finally { zip.close() }
    let confirmations = 0
    const report = await restoreBackup(archive, { maxCompressionRatio: candidate, parentDirectory: join(work, 'restores'), folderName: `r-${index++}`, appDataDirectory: join(work, 'app'), confirm: () => { confirmations++; return true } })
    const restoredHash = report.canOpen && report.destination ? (await inspectFixture(report.destination)).setSha256 : undefined
    const result = { name, exceeding, state: report.state, confirmations, destinationCreated: report.destinationCreated, codes: report.errors.map((e) => e.code), restoredHash }
    await appendFile(out, `${JSON.stringify(result)}\n`)
    if (shouldReject) {
      assert.equal(report.state, 'failed')
      assert.equal(report.destinationCreated, false)
      assert.equal(confirmations, 0)
      assert.ok(report.errors.some((e) => e.code === 'compression-ratio-exceeded' && e.stage === 'pre-validation'))
    } else {
      assert.equal(report.state, 'verified')
      assert.equal(restoredHash, expectedHash)
    }
    process.stdout.write(`${name}: ${report.state}; ${exceeding.length} entradas acima de ${candidate}:1\n`)
  }
  for (const level of [0, 1, 6, 9] as const) {
    const path = join(work, `f2-${level}.zip`)
    await writeExperimentArchive(f2Root, f2, path, level)
    await check(path, `F-2/level-${level}`, level !== 0, f2.setSha256)
  }
  for (const count of [8, 32] as const) {
    const root = join(work, `f3-${count}`)
    const inventory = await generateExpansion(root, count)
    for (const level of [1, 6, 9] as const) {
      const path = join(work, `f3-${count}-${level}.zip`)
      await writeExperimentArchive(root, inventory, path, level)
      await check(path, `F-3/${count}/level-${level}`, true)
    }
  }
  const path = join(work, 'export-store.zip')
  await exportBackup(f2Root, path, { maxCompressionRatio: candidate, decide: () => ({ nonCanonical: {} }) })
  await check(path, 'export-store', false, f2.setSha256)
} finally { await rm(work, { recursive: true, force: true }) }
