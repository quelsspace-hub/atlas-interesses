import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildIndex } from '../src/domain/derive.js'
import { VaultRepository } from '../src/vault/repository.js'
import { encodeRecord } from '../src/vault/serialize.js'

// D-027: metas medidas, não bloqueantes (indexar 1.000 registros ≤ 2 s; salvar ≤ 200 ms).
// Os limites das asserções são folgados para não gerar falso negativo em máquinas lentas de CI;
// os tempos observados são impressos como diagnóstico e registrados no TEST_PLAN.
test('D-027: indexação de 1.000 registros e salvamento de metadados', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-perf-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = new VaultRepository(root)
  await repo.ensureStructure()
  const T = '2026-10-19T12:00:00.000Z'
  const tags = Array.from({ length: 20 }, () => randomUUID())
  const write = (folder: string, meta: Record<string, unknown>, body: string) => writeFile(join(root, ...folder.split('/'), `${meta.id}.md`), encodeRecord(meta, Buffer.from(body)))
  const common = () => ({ id: randomUUID(), schema_version: 1, created_at: T, updated_at: T, archived_at: null })
  for (const id of tags) await write('tags', { ...common(), id, title: `Tag ${id.slice(0, 4)}` }, '')
  const items: string[] = []
  for (let i = 0; i < 300; i++) {
    const m = { ...common(), title: `Item ${i}`, type: 'project', status: 'active', tag_ids: [tags[i % 20]!], progress_mode: 'tasks', manual_progress: null }
    items.push(m.id)
    await write('items', m, `\n# Item ${i}\n\nTexto.\n`)
  }
  for (let i = 0; i < 400; i++) await write('tasks', { ...common(), title: `Tarefa ${i}`, status: i % 3 ? 'todo' : 'done', project_id: items[i % 300], is_next_action: false, sort_order: i, completed_at: i % 3 ? null : T }, '')
  const notes: string[] = []
  for (let i = 0; i < 280; i++) {
    const m = { ...common(), title: `Nota ${i}`, note_type: 'permanent', context_item_id: null, tag_ids: [tags[i % 20]!] }
    const link = notes.length ? `[ant](${notes[notes.length - 1]}.md)` : ''
    notes.push(m.id)
    await write('notes/permanent', m, `\nTexto ${i} ${link}\n`)
  }

  const started = performance.now()
  const report = await repo.load()
  const index = buildIndex(repo.views())
  const indexMs = performance.now() - started
  assert.equal(report.invalid.length, 0)
  assert.equal(repo.views().length, 1000)
  assert.equal(index.backlinks.size, 279)

  const target = repo.views().find((v) => v.kind === 'item')!
  let current = target
  const times: number[] = []
  for (let i = 0; i < 20; i++) {
    const s = performance.now()
    current = await repo.update(current.id, current.revision, { ...current.metadata, summary: `rev ${i}` })
    times.push(performance.now() - s)
  }
  times.sort((a, b) => a - b)
  const median = times[10]!
  const max = times[19]!
  t.diagnostic(JSON.stringify({ records: 1000, indexMs: Math.round(indexMs), saveMedianMs: Math.round(median * 10) / 10, saveMaxMs: Math.round(max * 10) / 10, rssMiB: Math.round(process.memoryUsage().rss / 2 ** 20) }))
  assert.ok(indexMs < 10_000, `indexação ${indexMs} ms`)
  assert.ok(median < 2_000, `salvamento ${median} ms`)
})
