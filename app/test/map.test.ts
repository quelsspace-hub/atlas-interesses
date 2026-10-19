import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndex, type RecordView } from '../src/domain/derive.js'
import { HUB_ID, UNGROUPED_ID, buildMapLayout, mapOutline } from '../src/domain/map.js'

const T = '2026-10-19T12:00:00.000Z'
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const base = (n: number, title: string) => ({ id: id(n), schema_version: 1, title, created_at: T, updated_at: T, archived_at: null })
const view = (kind: RecordView['kind'], path: string, metadata: Record<string, unknown>): RecordView => ({ kind, id: metadata.id as string, path, revision: 'r', metadata: metadata as never, body: '', problems: [] })
const item = (n: number, title: string, extra: Record<string, unknown> = {}) => view('item', `items/${id(n)}.md`, { ...base(n, title), type: 'project', tag_ids: [], status: 'active', progress_mode: 'tasks', manual_progress: null, ...extra })

const ux = id(50), dev = id(51)
function fixture(extra: RecordView[] = []) {
  return buildIndex([
    view('tag', `tags/${ux}.md`, base(50, 'UX')),
    view('tag', `tags/${dev}.md`, base(51, 'Dev')),
    view('group', `groups/${id(30)}.md`, { ...base(30, 'Design'), tag_ids: [ux], sort_order: 0, color: '#AA0000' }),
    view('group', `groups/${id(31)}.md`, { ...base(31, 'Tecnologia'), tag_ids: [ux, dev], sort_order: 1 }),
    view('group', `groups/${id(32)}.md`, { ...base(32, 'Vazio'), tag_ids: [], sort_order: 2 }),
    item(1, 'Compartilhado', { tag_ids: [ux] }),
    item(2, 'Só tecnologia', { tag_ids: [dev], type: 'course', progress_mode: 'manual', manual_progress: 0 }),
    item(3, 'Solto'),
    item(4, 'Arquivado', { tag_ids: [dev], status: 'archived', archived_at: T }),
    view('note', `notes/work/${id(6)}.md`, { ...base(6, 'Nota de contexto'), note_type: 'work', context_item_id: id(1), tag_ids: [] }),
    ...extra
  ])
}

test('V3: hub no centro, grupos no anel, item compartilhado ligado aos dois grupos, Sem grupo, arquivado oculto', () => {
  const layout = buildMapLayout(fixture())
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))
  assert.deepEqual([byId.get(HUB_ID)!.x, byId.get(HUB_ID)!.y], [0, 0])
  assert.deepEqual(layout.nodes.filter((n) => n.kind === 'group').map((n) => n.label), ['Design', 'Tecnologia', 'Vazio'], 'grupo sem tags aparece')
  assert.ok(byId.has(UNGROUPED_ID))
  assert.equal(layout.nodes.filter((n) => n.kind === 'item').length, 3, 'um nó por item, sem duplicar')
  assert.ok(!byId.has(id(4)), 'arquivado oculto por padrão')
  const memberships = (itemId: string) => layout.edges.filter((e) => e.to === itemId && e.kind === 'membership').map((e) => e.from).sort()
  assert.deepEqual(memberships(id(1)), [id(30), id(31)])
  assert.deepEqual(memberships(id(2)), [id(31)])
  assert.deepEqual(memberships(id(3)), [UNGROUPED_ID])
  const shared = byId.get(id(1))!
  assert.ok(Math.hypot(shared.x, shared.y) < Math.hypot(byId.get(id(2))!.x, byId.get(id(2))!.y), 'compartilhado fica entre os grupos (anel interno)')
  assert.equal(byId.get(id(30))!.color, '#AA0000')
})

test('V3: determinístico, sem sobreposição de itens e com filtros, notas e arquivados', () => {
  const many = Array.from({ length: 60 }, (_, i) => item(100 + i, `Item ${String(i).padStart(2, '0')}`, { tag_ids: [ux] }))
  const index = fixture(many)
  const a = buildMapLayout(index)
  const b = buildMapLayout(index)
  assert.deepEqual(a, b, 'mesma entrada, mesmas posições')
  const items = a.nodes.filter((n) => n.kind === 'item')
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    assert.ok(Math.hypot(items[i]!.x - items[j]!.x, items[i]!.y - items[j]!.y) >= items[i]!.r + items[j]!.r, `${items[i]!.label} × ${items[j]!.label}`)
  }
  const filtered = buildMapLayout(index, { itemTypes: ['course'] })
  assert.deepEqual(filtered.nodes.filter((n) => n.kind === 'item').map((n) => n.id), [id(2)])
  const withNotes = buildMapLayout(index, { showNotes: true, includeArchived: true })
  assert.ok(withNotes.nodes.some((n) => n.id === id(6) && n.kind === 'note'))
  assert.ok(withNotes.edges.some((e) => e.from === id(1) && e.to === id(6) && e.kind === 'context'))
  assert.ok(withNotes.nodes.some((n) => n.id === id(4)))
  assert.ok(Number.isFinite(a.bounds.minX) && a.bounds.maxX > a.bounds.minX)
})

test('V3: alternativa em listas tem os mesmos itens visíveis que o mapa', () => {
  const index = fixture()
  const outline = mapOutline(index)
  assert.deepEqual(outline.map((g) => [g.label, g.items.map((i) => i.metadata.title)]), [
    ['Design', ['Compartilhado']],
    ['Tecnologia', ['Compartilhado', 'Só tecnologia']],
    ['Vazio', []],
    ['Sem grupo', ['Solto']]
  ])
  const mapItems = new Set(buildMapLayout(index).nodes.filter((n) => n.kind === 'item').map((n) => n.id))
  assert.deepEqual(new Set(outline.flatMap((g) => g.items.map((i) => i.id))), mapItems)
})
