import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndex, type RecordView } from '../src/domain/derive.js'
import { DEFAULT_RELATIONS, buildGraph } from '../src/domain/graph.js'

const T = '2026-10-19T12:00:00.000Z'
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const base = (n: number, title: string) => ({ id: id(n), schema_version: 1, title, created_at: T, updated_at: T, archived_at: null })
const view = (kind: RecordView['kind'], path: string, metadata: Record<string, unknown>, body = ''): RecordView => ({ kind, id: metadata.id as string, path, revision: 'r', metadata: metadata as never, body, problems: [] })
const ux = id(50)
const notePath = (type: string, n: number) => `notes/${type}/${id(n)}.md`

function fixture(extra: RecordView[] = []) {
  return buildIndex([
    view('tag', `tags/${ux}.md`, base(50, 'UX')),
    view('group', `groups/${id(30)}.md`, { ...base(30, 'Design'), tag_ids: [ux], sort_order: 0 }),
    view('capture', `inbox/${id(7)}.md`, { id: id(7), schema_version: 1, title: null, capture_kind: 'project', status: 'processed', captured_at: T, processed_at: T, archived_at: null, converted_to_type: 'project', converted_to_id: id(1) }, '\nIdeia original\n'),
    view('item', `items/${id(1)}.md`, { ...base(1, 'Projeto'), type: 'project', tag_ids: [ux], status: 'active', progress_mode: 'tasks', manual_progress: null, origin_capture_id: id(7) }),
    view('task', `tasks/${id(2)}.md`, { ...base(2, 'Tarefa'), status: 'todo', project_id: id(1), is_next_action: false, sort_order: 0, completed_at: null }),
    view('note', notePath('work', 3), { ...base(3, 'Trabalho'), note_type: 'work', context_item_id: id(1), tag_ids: [] }, `\nVer [permanente](../permanent/${id(4)}.md) e [quebrado](../permanent/${id(9)}.md).\n`),
    view('note', notePath('permanent', 4), { ...base(4, 'Permanente'), note_type: 'permanent', context_item_id: null, tag_ids: [ux] }, `\nOrigem: [Trabalho](../work/${id(3)}.md)\n`),
    view('note', notePath('permanent', 5), { ...base(5, 'Isolada'), note_type: 'permanent', context_item_id: null, tag_ids: [] }),
    ...extra
  ])
}

test('V4: links persistidos e relações derivadas distinguidos e explicados; link quebrado visível', () => {
  const g = buildGraph(fixture())
  const find = (kind: string, from: number, to: number | string) => g.edges.find((e) => e.kind === kind && e.from === id(from) && e.to === (typeof to === 'number' ? id(to) : to))
  const persisted = find('link', 3, 4)!
  assert.equal(persisted.persisted, true)
  assert.match(persisted.why, /escrito no corpo de “Trabalho”/)
  assert.ok(find('link', 4, 3), 'link de volta (D-008) também é persistido')
  assert.equal(find('context', 3, 1)!.persisted, false)
  assert.match(find('context', 3, 1)!.why, /context_item_id/)
  assert.match(find('project', 2, 1)!.why, /project_id/)
  assert.match(find('origin', 1, 7)!.why, /origin_capture_id/)
  const broken = g.edges.find((e) => e.broken)!
  assert.equal(broken.to, `missing:notes/permanent/${id(9)}.md`)
  assert.ok(g.nodes.some((n) => n.kind === 'missing'))
  assert.ok(!g.nodes.some((n) => n.id === id(5)), 'sem relações, a nota isolada fica fora da vista global')
  assert.ok(!g.edges.some((e) => e.kind === 'tag' || e.kind === 'group'), 'tags e grupos desligados por padrão')
  assert.deepEqual(DEFAULT_RELATIONS, ['link', 'context', 'project', 'origin'])
})

test('V4: relações derivadas de tag e grupo explicam a regra OR', () => {
  const g = buildGraph(fixture(), { relations: ['tag', 'group'] })
  const group = g.edges.find((e) => e.kind === 'group')!
  assert.equal(group.from, id(1))
  assert.match(group.why, /compartilha a\(s\) tag\(s\) UX com o grupo “Design”/)
  assert.ok(g.edges.filter((e) => e.kind === 'tag').length === 2, 'item e nota permanente marcados com UX')
  assert.ok(g.edges.every((e) => !e.persisted))
})

test('V4: navegação controlada por foco e profundidade; limite de nós com aviso', () => {
  const index = fixture()
  const d1 = buildGraph(index, { focusId: id(3), depth: 1 })
  assert.deepEqual(d1.nodes.map((n) => n.id).sort(), [id(1), id(3), id(4), `missing:notes/permanent/${id(9)}.md`].sort())
  assert.equal(d1.nodes.find((n) => n.id === id(3))!.depth, 0)
  assert.deepEqual([d1.nodes.find((n) => n.id === id(3))!.x, d1.nodes.find((n) => n.id === id(3))!.y], [0, 0], 'foco no centro')
  const d2 = buildGraph(index, { focusId: id(3), depth: 2 })
  assert.ok(d2.nodes.some((n) => n.id === id(2) && n.depth === 2), 'tarefa a dois saltos')
  assert.ok(d2.nodes.some((n) => n.id === id(7) && n.depth === 2), 'captura a dois saltos')

  const many = Array.from({ length: 300 }, (_, i) => view('note', notePath('permanent', 1000 + i), { ...base(1000 + i, `N${i}`), note_type: 'permanent', context_item_id: null, tag_ids: [] }, `\n[a](${id(1000 + ((i + 1) % 300))}.md) [b](${id(1000 + ((i + 7) % 300))}.md)\n`))
  const big = fixture(many)
  const t0 = performance.now()
  const limited = buildGraph(big, { maxNodes: 150 })
  const ms = performance.now() - t0
  assert.equal(limited.nodes.length, 150)
  assert.ok(limited.truncated && limited.total > 150)
  assert.ok(limited.edges.every((e) => limited.nodes.some((n) => n.id === e.from) && limited.nodes.some((n) => n.id === e.to)), 'sem arestas soltas')
  assert.deepEqual(buildGraph(big, { maxNodes: 150 }).nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]), limited.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]), 'determinístico')
  assert.ok(limited.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)))
  console.log(JSON.stringify({ candidates: limited.total, shown: limited.nodes.length, layoutMs: Math.round(ms) }))
  assert.ok(ms < 5000)
})
