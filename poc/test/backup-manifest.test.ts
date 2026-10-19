import assert from 'node:assert/strict'
import { test } from 'node:test'
import { backupPathProblem, buildManifest, manifestProblems, serializeManifest } from '../src/backup/manifest.js'

const hash = 'a'.repeat(64)

test('M-B: lista ordenada por bytes UTF-8, sem o próprio manifesto, com versão e data UTC', () => {
  const manifest = buildManifest(
    [
      { path: 'tags/b.md', size: 2, sha256: hash },
      { path: 'assets/ação.bin', size: 3, sha256: hash },
      { path: 'assets/acao.bin', size: 1, sha256: hash }
    ],
    new Date('2026-10-18T12:00:00.000Z')
  )
  assert.deepEqual(manifest.files.map((file) => file.path), ['assets/acao.bin', 'assets/ação.bin', 'tags/b.md'])
  assert.equal(manifest.manifest_version, 1)
  assert.equal(manifest.created_at, '2026-10-18T12:00:00.000Z')
  assert.equal(manifest.file_count, 3)
  assert.deepEqual(manifestProblems(JSON.parse(serializeManifest(manifest).toString('utf8'))), [])
})

test('M-B: recusa versão desconhecida, contagem divergente, duplicata, desordem e autorreferência', () => {
  const base = { manifest_version: 1, created_at: '2026-10-18T12:00:00.000Z' }
  assert.ok(manifestProblems({ ...base, manifest_version: 2, file_count: 0, files: [] }).some((p) => p.includes('manifest_version')))
  assert.ok(manifestProblems({ ...base, file_count: 1, files: [] }).some((p) => p.includes('file_count')))
  const twice = [{ path: 'a.md', size: 1, sha256: hash }, { path: 'a.md', size: 1, sha256: hash }]
  assert.ok(manifestProblems({ ...base, file_count: 2, files: twice }).some((p) => p.includes('sorted')))
  const unsorted = [{ path: 'b.md', size: 1, sha256: hash }, { path: 'a.md', size: 1, sha256: hash }]
  assert.ok(manifestProblems({ ...base, file_count: 2, files: unsorted }).some((p) => p.includes('sorted')))
  const byCase = [{ path: 'A.md', size: 1, sha256: hash }, { path: 'a.md', size: 1, sha256: hash }]
  assert.ok(manifestProblems({ ...base, file_count: 2, files: byCase }).some((p) => p.includes('case or Unicode')))
  const self = [{ path: 'manifest.json', size: 1, sha256: hash }]
  assert.ok(manifestProblems({ ...base, file_count: 1, files: self }).some((p) => p.includes('lists itself')))
  assert.ok(manifestProblems({ ...base, created_at: '2026-10-18 12:00', file_count: 0, files: [] }).some((p) => p.includes('created_at')))
})

test('M-B: caminhos relativos com "/" sem travessia, raiz ou unidade', () => {
  assert.equal(backupPathProblem('notes/work/a.md'), null)
  for (const unsafe of ['../a.md', 'a/../b.md', '/a.md', 'C:/a.md', 'a\\b.md', 'a//b.md', './a.md', '']) {
    assert.notEqual(backupPathProblem(unsafe), null, unsafe)
  }
})
