import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, inflateSync } from 'node:zlib'
import { test } from 'node:test'
import { generateF2, MiB, sha256 } from '../bench/f2-fixture.js'
import { measureEntries, writeExperimentArchive } from '../bench/f2-archive.js'
import { experiment } from '../bench/f2-worker.js'
import { summarize, type Scenario } from '../bench/f2-run.js'
import { parseFrontmatterDocument } from '../src/core/frontmatter.js'
import { isUuidV4 } from '../src/core/identity.js'
import { scanVault } from '../src/backup/inventory.js'
import { BackupFileSystem } from '../src/backup/backup-fs.js'
import { listEntries, openArchive, openEntry } from '../src/backup/verify-archive.js'

test('Resumo não aceita registros parciais, duplicados ou operações com falha', () => {
  assert.throws(() => summarize([]), /incomplete experiment/)
  const empty = { files: [], bytes: 0, setSha256: '' }
  const scenarios: Scenario[] = [
    ...['F-2.v1', 'F-3-expansion-8', 'F-3-expansion-32'].flatMap((name) => ([0, 1, 6, 9] as const).map((level): Scenario => ({ type: 'scenario', name, level, fixture: empty, runs: [] }))),
    ...(['size', 'hash', 'truncated'] as const).map((corruption): Scenario => ({ type: 'scenario', name: `F-3-${corruption}`, level: 6, corruption, fixture: empty, runs: [] }))
  ]
  assert.throws(() => summarize(scenarios), /incomplete or failed scenario/)
  // Falhas não são descartadas ao calcular medianas.
  for (const scenario of scenarios) scenario.runs = Array.from({ length: 5 }, () => ({
    ok: !scenario.corruption, rejected: false, restoreState: 'verified', confirmationCalls: 1, destinationCreated: true,
    entries: [], zipBytes: 0, totalMs: 0, maxRssBytes: 0, phases: [],
    disk: { freeBefore: 0, freeAfterZip: 0, freeAfterRestore: 0, logicalPeakBytes: 0 }
  }))
  assert.throws(() => summarize(scenarios), /incomplete or failed scenario/)
  scenarios[1] = scenarios[0]
  assert.throws(() => summarize(scenarios), /duplicate or unexpected scenario/)
})

test('F-2.v1: reprodutibilidade, relações, formatos PNG/PDF e LF/CRLF', async (t) => {
  const work = await mkdtemp(join(tmpdir(), 'atlas-f2-test-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  const root = join(work, 'first')
  const first = await generateF2(root)
  assert.deepEqual(await generateF2(join(work, 'second')), first)
  await assert.rejects(generateF2(root), { code: 'EEXIST' })
  assert.equal(first.files.length, 21)
  // Fixa a identidade da versão aprovada; mudar bytes exige revisar a versão do corpus.
  assert.equal(first.setSha256, '5e22d0a099e2ed05a793d9600d2cfe6687fd668ed2434c6de655b6d2f384b16a')
  const png = await readFile(join(root, 'assets/image.png'))
  const pdf = await readFile(join(root, 'assets/document.pdf'))
  assert.equal(first.bytes, 21626932 + png.length + pdf.length)
  assert.deepEqual(png.subarray(0, 8), Buffer.from('89504e470d0a1a0a', 'hex'))
  const compressed: Buffer[] = []
  const types: string[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    types.push(type)
    assert.equal(crc32(png.subarray(offset + 4, offset + 8 + length)), png.readUInt32BE(offset + 8 + length))
    if (type === 'IHDR') {
      assert.equal(png.readUInt32BE(offset + 8), 256)
      assert.equal(png.readUInt32BE(offset + 12), 256)
      assert.deepEqual([...png.subarray(offset + 16, offset + 21)], [8, 2, 0, 0, 0])
    }
    if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  assert.deepEqual(types, ['IHDR', 'IDAT', 'IEND'])
  const rows = inflateSync(Buffer.concat(compressed))
  assert.equal(rows.length, 256 * 769)
  for (let i = 0; i < 256; i++) assert.equal(rows[i * 769], 0)
  const pdfText = pdf.toString('latin1')
  assert.ok(pdfText.startsWith('%PDF-1.4'))
  const xref = Number(/startxref\n(\d+)\n%%EOF/.exec(pdfText)![1])
  assert.ok(pdfText.slice(xref).startsWith('xref\n0 6\n'))
  const entries = pdfText.slice(xref).split('\n').slice(3, 8)
  for (const [i, entry] of entries.entries()) assert.ok(pdfText.slice(Number(entry.slice(0, 10))).startsWith(`${i + 1} 0 obj\n`))
  const imageHead = /4 0 obj\n<<[^>]*\/Length (\d+) >>\nstream\n/.exec(pdfText)!
  const imageStart = imageHead.index + imageHead[0].length
  assert.equal(inflateSync(pdf.subarray(imageStart, imageStart + Number(imageHead[1]))).length, 256 * 256 * 3)
  const records: Array<{ folder: string; metadata: Record<string, unknown> }> = []
  let crlf = 0
  for (const file of first.files.filter((f) => f.bodySha256)) {
    const bytes = await readFile(join(root, file.path))
    const parts = parseFrontmatterDocument(bytes)
    assert.equal(bytes.length, 65536)
    assert.equal(sha256(parts.body), file.bodySha256)
    assert.ok(isUuidV4(parts.metadata.id))
    if (bytes.subarray(0, 5).toString() === '---\r\n') crlf++
    records.push({ folder: file.path.split('/')[0], metadata: parts.metadata })
  }
  assert.equal(crlf, 5)
  const tags = records.filter((r) => r.folder === 'tags').map((r) => r.metadata.id)
  const items = records.filter((r) => r.folder === 'items').map((r) => r.metadata)
  for (const { metadata } of records) {
    if (Array.isArray(metadata.tag_ids)) assert.ok(metadata.tag_ids.every((id) => tags.includes(id)))
    if (metadata.note_type === 'work') assert.ok(items.some((i) => i.id === metadata.context_item_id))
    if (metadata.note_type === 'reading' || metadata.note_type === 'permanent') assert.equal(metadata.context_item_id, null)
    if (metadata.project_id) assert.ok(items.some((i) => i.id === metadata.project_id && i.type === 'project'))
  }
  for (const item of items) assert.ok(!('group_id' in item) && !('group_ids' in item))
  for (const group of records.filter((r) => r.folder === 'groups')) assert.ok(items.some((i) => (i.tag_ids as string[]).some((tag) => (group.metadata.tag_ids as string[]).includes(tag))))
  const scanned = await scanVault(root, new BackupFileSystem())
  assert.deepEqual(scanned.blocks, [])
  assert.equal(scanned.canonical.length, 21)
})

test('F-2.v1: store/deflate, SHA-256 e corpo idênticos após restore', async (t) => {
  const work = await mkdtemp(join(tmpdir(), 'atlas-f2-roundtrip-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  const root = join(work, 'vault')
  const inventory = await generateF2(root)
  for (const level of [0, 1, 6, 9] as const) await t.test(`nível ${level}`, async () => {
    const result = await experiment({ root, inventory, work: join(work, `run-${level}`), level })
    assert.equal(result.ok, true, result.error)
    assert.equal(result.restoreState, 'verified')
    assert.equal(result.entries.length, 22)
    assert.equal(result.confirmationCalls, 1)
    assert.equal(result.entries.find((e) => e.path === 'assets/empty.bin')!.ratio, null)
    const zero = result.entries.find((e) => e.path === 'assets/zeros-8388608.bin')!
    assert.equal(zero.actualBytes, 8 * MiB)
    assert.equal(zero.method, level === 0 ? 0 : 8)
    if (level === 0) assert.equal(zero.ratio, 1)
    else assert.ok(zero.ratio! > 100)
  })
})

test('F-3: tamanho falso coerente, hash falso e deflate truncado recusados antes da confirmação', async (t) => {
  const work = await mkdtemp(join(tmpdir(), 'atlas-f3-corruption-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  const root = join(work, 'vault')
  const inventory = await generateF2(root)
  for (const corruption of ['size', 'hash', 'truncated'] as const) await t.test(corruption, async () => {
    const runWork = join(work, corruption)
    const result = await experiment({ root, inventory, work: runWork, level: 6, corruption })
    assert.equal(result.ok, true, result.error)
    assert.equal(result.rejected, true)
    assert.equal(result.rejectionStage, 'pre-validation')
    assert.equal(result.destinationCreated, false)
    assert.equal(result.confirmationCalls, 0)
    if (corruption === 'size') {
      const zip = await openArchive(join(runWork, 'experiment.zip'))
      try {
        const entries = await listEntries(zip)
        const manifestEntry = entries.find((e) => e.fileName === 'manifest.json')!
        const chunks: Buffer[] = []
        for await (const chunk of await openEntry(zip, manifestEntry)) chunks.push(chunk as Buffer)
        const manifest = JSON.parse(Buffer.concat(chunks).toString())
        assert.equal(entries[0].uncompressedSize, manifest.files[0].size)
        assert.equal(entries[0].uncompressedSize, inventory.files[0].size - 1)
      } finally { zip.close() }
    }
  })
})

test('Laboratório: erros de I/O e saída existente não viram sucesso', async (t) => {
  const work = await mkdtemp(join(tmpdir(), 'atlas-f2-errors-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  const root = join(work, 'vault')
  const inventory = await generateF2(root)
  const archive = join(work, 'out.zip')
  await writeExperimentArchive(root, inventory, archive, 6)
  const before = sha256(await readFile(archive))
  await assert.rejects(writeExperimentArchive(root, inventory, archive, 6), { code: 'EEXIST' })
  assert.equal(sha256(await readFile(archive)), before)
  await assert.rejects(writeExperimentArchive(join(work, 'missing'), inventory, join(work, 'missing.zip'), 6))
  await assert.rejects(measureEntries(join(work, 'absent.zip')))
})
