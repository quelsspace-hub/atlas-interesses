import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndex, groupItems, groupNotes, itemProgress, nextSortOrder, taskProgress, ungroupedItems, type RecordView } from '../src/domain/derive.js'
import { extractLinks, markdownLink, relativeHref, resolveRelative } from '../src/domain/links.js'
import { defaultProgressMode } from '../src/domain/model.js'
import { hasErrors, validateEntity } from '../src/domain/validate.js'

const T = '2026-10-19T12:00:00.000Z'
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const base = (n: number, title = `R${n}`) => ({ id: id(n), schema_version: 1, title, created_at: T, updated_at: T, archived_at: null })
const view = <K extends RecordView['kind']>(kind: K, path: string, metadata: Record<string, unknown>, body = ''): RecordView => ({ kind, id: metadata.id as string, path, revision: 'r', metadata: metadata as never, body, problems: [] })

const item = (n: number, extra: Record<string, unknown> = {}) => ({ ...base(n), type: 'project', tag_ids: [], status: 'active', progress_mode: 'tasks', manual_progress: null, ...extra })

test('validação aceita os exemplos de cada tipo e recusa enums, UUID e D-001 inválidos', () => {
  assert.deepEqual(validateEntity('item', item(1)), [])
  assert.deepEqual(validateEntity('tag', base(2)), [])
  assert.deepEqual(validateEntity('group', { ...base(3), tag_ids: [], sort_order: 0 }), [])
  assert.deepEqual(validateEntity('task', { ...base(4), status: 'todo', project_id: null, is_next_action: false, sort_order: 0, completed_at: null }), [])
  assert.deepEqual(validateEntity('note', { ...base(5), note_type: 'permanent', context_item_id: null, tag_ids: [] }, 'permanent'), [])
  assert.deepEqual(validateEntity('capture', { id: id(6), schema_version: 1, title: null, capture_kind: 'undecided', status: 'pending', captured_at: T, processed_at: null, archived_at: null, converted_to_type: null, converted_to_id: null }), [])

  assert.ok(hasErrors(validateEntity('item', item(1, { status: 'canceled' }))), 'canceled não é Item.status')
  assert.ok(hasErrors(validateEntity('item', item(1, { priority: 'urgent' }))), 'urgent não é prioridade')
  assert.ok(hasErrors(validateEntity('item', item(1, { type: 'idea' }))), 'tasks só para project')
  assert.ok(hasErrors(validateEntity('item', item(1, { progress_mode: 'manual', manual_progress: 101 }))))
  assert.ok(hasErrors(validateEntity('item', { ...item(1), schema_version: 2 })))
  assert.ok(hasErrors(validateEntity('item', { ...item(1), id: 'not-a-uuid' })))
  assert.ok(hasErrors(validateEntity('note', { ...base(5), note_type: 'work', context_item_id: null, tag_ids: [] }, 'work')), 'D-001: work exige contexto')
  assert.ok(hasErrors(validateEntity('note', { ...base(5), note_type: 'permanent', context_item_id: id(1), tag_ids: [] }, 'permanent')), 'D-001: permanent sem contexto')
  assert.ok(hasErrors(validateEntity('note', { ...base(5), note_type: 'reading', context_item_id: null, tag_ids: [] }, 'work')), 'pasta incoerente')
  assert.ok(hasErrors(validateEntity('group', { ...base(3), tag_ids: [id(2), id(2)], sort_order: 0 })), 'tag duplicada')
  assert.ok(hasErrors(validateEntity('item', { ...item(1), start_date: '2026-02-30' })), 'data inexistente')
})

test('D-003/D-022: todo + done + canceled = 50%; só canceled = null; arquivadas contam pelo status', () => {
  assert.equal(taskProgress([{ status: 'todo' }, { status: 'done' }, { status: 'canceled' }]), 50)
  assert.equal(taskProgress([{ status: 'canceled' }]), null)
  assert.equal(taskProgress([]), null)
  const project = item(1)
  const tasks = [
    { ...base(10), status: 'done', project_id: id(1), is_next_action: false, sort_order: 0, completed_at: T, archived_at: T },
    { ...base(11), status: 'todo', project_id: id(1), is_next_action: true, sort_order: 1, completed_at: null },
    { ...base(12), status: 'done', project_id: id(2), is_next_action: false, sort_order: 2, completed_at: T }
  ]
  const index = buildIndex([view('item', `items/${id(1)}.md`, project), ...tasks.map((t) => view('task', `tasks/${t.id}.md`, t))])
  assert.equal(itemProgress(index, project as never), 50, 'tarefa de outro projeto não conta; arquivada conta pelo status')
  assert.equal(itemProgress(index, { ...project, progress_mode: 'manual', manual_progress: 30 } as never), 30)
  assert.equal(itemProgress(index, { ...project, progress_mode: 'none' } as never), null)
  assert.equal(defaultProgressMode('project'), 'tasks')
  assert.equal(defaultProgressMode('idea'), 'none')
  assert.equal(defaultProgressMode('course'), 'manual')
  assert.equal(nextSortOrder([]), 0)
  assert.equal(nextSortOrder([{ metadata: { sort_order: 4 } }, { metadata: { sort_order: 1 } }]), 5)
})

test('D-004/D-024: item com tag compartilhada aparece em dois grupos; notas em seção separada; Sem grupo', () => {
  const ux = id(20)
  const records = [
    view('group', `groups/${id(30)}.md`, { ...base(30, 'Design'), tag_ids: [ux], sort_order: 0 }),
    view('group', `groups/${id(31)}.md`, { ...base(31, 'Tecnologia'), tag_ids: [ux, id(21)], sort_order: 1 }),
    view('tag', `tags/${ux}.md`, base(20, 'UX')),
    view('item', `items/${id(1)}.md`, item(1, { tag_ids: [ux] })),
    view('item', `items/${id(2)}.md`, item(2)),
    view('note', `notes/permanent/${id(5)}.md`, { ...base(5), note_type: 'permanent', context_item_id: null, tag_ids: [ux] })
  ]
  const index = buildIndex(records)
  const [design, tech] = index.groups
  assert.deepEqual(groupItems(index, design!.metadata as never).map((i) => i.id), [id(1)])
  assert.deepEqual(groupItems(index, tech!.metadata as never).map((i) => i.id), [id(1)])
  assert.deepEqual(groupNotes(index, design!.metadata as never).map((n) => n.id), [id(5)])
  assert.deepEqual(ungroupedItems(index).map((i) => i.id), [id(2)])
})

test('links relativos: geração, resolução, backlinks e links quebrados sem apagar texto', () => {
  const work = `notes/work/${id(6)}.md`
  const perm = `notes/permanent/${id(7)}.md`
  assert.equal(relativeHref(work, perm), `../permanent/${id(7)}.md`)
  assert.equal(relativeHref(`items/${id(1)}.md`, work), `../notes/work/${id(6)}.md`)
  assert.equal(relativeHref(work, `notes/work/${id(8)}.md`), `${id(8)}.md`)
  assert.equal(resolveRelative(work, '../../../fora.md'), null)
  assert.equal(markdownLink(work, perm, 'Título [x]'), `[Título \\[x\\]](../permanent/${id(7)}.md)`)

  const body = `Ver [perm](../permanent/${id(7)}.md#sec), [quebrado](../permanent/${id(9)}.md), [site](https://example.com) e \`[código](../permanent/${id(7)}.md)\`.\n\n\`\`\`\n[fence](../permanent/${id(7)}.md)\n\`\`\`\n`
  const links = extractLinks(work, body, new Set([perm]))
  assert.deepEqual(links.map((l) => [l.kind, l.targetId ?? null, l.fragment ?? null]), [['record', id(7), 'sec'], ['missing', id(9), null], ['external', null, null]])

  const index = buildIndex([
    view('note', work, { ...base(6), note_type: 'work', context_item_id: id(1), tag_ids: [] }, body),
    view('note', perm, { ...base(7), note_type: 'permanent', context_item_id: null, tag_ids: [] })
  ])
  assert.deepEqual(index.backlinks.get(id(7)), [id(6)])
})
