import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ZipFile } from 'yazl'
import { buildManifest, pathLimitProblem, serializeManifest } from '../src/vault/backup/manifest.js'
import { restoreBackup } from '../src/vault/backup/restore.js'
import { DEFAULT_MAX_COMPRESSION_RATIO } from '../src/vault/backup/compression.js'

// D-019: nomes reservados do Windows, finais com espaço/ponto e <>:"|?* são recusados sem renomear.
test('D-019: segmentos reservados ou não representáveis no Windows são recusados', () => {
  for (const path of ['assets/CON', 'assets/con.txt', 'assets/Nul.tar.gz', 'assets/COM1.md', 'assets/lpt9', 'assets/sub./a', 'assets/fim ', 'assets/a?b', 'assets/a:b', 'assets/a|b', 'assets/"x"']) {
    assert.equal(pathLimitProblem(path)?.code, 'reserved-name', path)
  }
  for (const path of ['assets/console.txt', 'assets/com10', 'assets/lpt0', 'assets/a.b', 'assets/ação.bin', 'notes/work/x.md']) {
    assert.equal(pathLimitProblem(path), null, path)
  }
  assert.equal(DEFAULT_MAX_COMPRESSION_RATIO, 128, 'D-018')
})

test('D-019: restauração recusa ZIP com nome reservado antes de confirmar ou criar destino', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-d019-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const data = Buffer.from('x')
  const name = 'assets/aux.txt'
  const manifest = serializeManifest(buildManifest([{ path: name, size: data.length, sha256: createHash('sha256').update(data).digest('hex') }], new Date('2026-10-19T00:00:00Z')))
  const zip = new ZipFile()
  zip.addBuffer(data, name, { compress: false })
  zip.addBuffer(manifest, 'manifest.json', { compress: false })
  zip.end()
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => { zip.outputStream.on('data', (c: Buffer) => chunks.push(c)).on('end', resolve).on('error', reject) })
  const archive = join(root, 'b.zip')
  await writeFile(archive, Buffer.concat(chunks))
  let confirmed = false
  const report = await restoreBackup(archive, { parentDirectory: root, folderName: 'r', appDataDirectory: join(root, 'app'), maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO, confirm: () => { confirmed = true; return true } })
  assert.equal(report.state, 'failed')
  assert.equal(confirmed, false)
  assert.equal(report.destinationCreated, false)
  assert.ok(report.errors.some((e) => e.message.includes('D-019')), JSON.stringify(report.errors))
  assert.ok(!(await readdir(root)).includes('r'))
})
