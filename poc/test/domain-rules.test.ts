import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateProjectProgress,
  itemBelongsToGroup,
  noteContextViolation,
  type ProgressTaskSlice,
  type TagMembershipSlice
} from '../src/core/domain-rules.js'

const sharedTag = '11111111-1111-4111-8111-111111111111'
const groupOnlyTag = '22222222-2222-4222-8222-222222222222'
const itemOnlyTag = '33333333-3333-4333-8333-333333333333'

test('uma tag compartilhada basta; não exige interseção completa', () => {
  const group: TagMembershipSlice = { tag_ids: [sharedTag, groupOnlyTag] }
  const item: TagMembershipSlice = { tag_ids: [sharedTag, itemOnlyTag] }

  assert.equal(itemBelongsToGroup(item, group), true)
})

test('grupo ou item sem tags não produz associação', () => {
  assert.equal(itemBelongsToGroup({ tag_ids: [] }, { tag_ids: [sharedTag] }), false)
  assert.equal(itemBelongsToGroup({ tag_ids: [sharedTag] }, { tag_ids: [] }), false)
  assert.equal(itemBelongsToGroup({ tag_ids: [] }, { tag_ids: [] }), false)
})

test('nomes iguais sem UUID compartilhado não produzem associação', () => {
  const group = { tag_ids: [sharedTag], title: 'Design', aliases: ['UX'], color: '#241F6F' }
  const item = { tag_ids: [groupOnlyTag], title: 'Design', aliases: ['UX'], color: '#241F6F' }

  assert.equal(itemBelongsToGroup(item, group), false)
})

test('um Item pode pertencer a vários Groups pelo mesmo UUID de tag', () => {
  const item: TagMembershipSlice = { tag_ids: [sharedTag] }
  const firstGroup: TagMembershipSlice = { tag_ids: [sharedTag, groupOnlyTag] }
  const secondGroup: TagMembershipSlice = { tag_ids: [itemOnlyTag, sharedTag] }

  assert.equal(itemBelongsToGroup(item, firstGroup), true)
  assert.equal(itemBelongsToGroup(item, secondGroup), true)
})

test('verificar associação não modifica os argumentos', () => {
  const item = Object.freeze({ tag_ids: Object.freeze([sharedTag, itemOnlyTag]) })
  const group = Object.freeze({ tag_ids: Object.freeze([sharedTag, groupOnlyTag]) })
  const before = structuredClone({ item, group })

  assert.equal(itemBelongsToGroup(item, group), true)
  assert.deepEqual({ item, group }, before)
})

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherProjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('progresso sem tarefas elegíveis retorna null', () => {
  assert.equal(calculateProjectProgress(projectId, []), null)
  assert.equal(calculateProjectProgress(projectId, [{ project_id: projectId, status: 'canceled' }]), null)
})

test('tarefas abertas produzem zero e todas concluídas produzem cem', () => {
  assert.equal(
    calculateProjectProgress(projectId, [
      { project_id: projectId, status: 'todo' },
      { project_id: projectId, status: 'in_progress' }
    ]),
    0
  )
  assert.equal(
    calculateProjectProgress(projectId, [
      { project_id: projectId, status: 'done' },
      { project_id: projectId, status: 'done' }
    ]),
    100
  )
})

test('mistura todo, in_progress, done e canceled exclui canceled', () => {
  const tasks: ProgressTaskSlice[] = [
    { project_id: projectId, status: 'todo' },
    { project_id: projectId, status: 'in_progress' },
    { project_id: projectId, status: 'done' },
    { project_id: projectId, status: 'canceled' }
  ]

  assert.equal(calculateProjectProgress(projectId, tasks), (100 * 1) / 3)
})

test('tarefas de outro projeto e avulsas não interferem', () => {
  const tasks: ProgressTaskSlice[] = [
    { project_id: projectId, status: 'done' },
    { project_id: otherProjectId, status: 'todo' },
    { project_id: null, status: 'todo' }
  ]

  assert.equal(calculateProjectProgress(projectId, tasks), 100)
  assert.equal(calculateProjectProgress(otherProjectId, tasks), 0)
})

test('progresso fracionário não arredonda nem modifica os dados', () => {
  const project = Object.freeze({ id: projectId, status: 'active' as const })
  const tasks = Object.freeze([
    Object.freeze({ project_id: projectId, status: 'done' as const }),
    Object.freeze({ project_id: projectId, status: 'todo' as const }),
    Object.freeze({ project_id: projectId, status: 'todo' as const })
  ])
  const before = structuredClone({ project, tasks })

  assert.equal(calculateProjectProgress(project.id, tasks), (100 * 1) / 3)
  assert.deepEqual({ project, tasks }, before)
})

const contextItemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const unknownItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const knownItemIds: ReadonlySet<string> = new Set([contextItemId])

test('D-001: work exige Item; null, chave ausente ou referência inválida são rejeitados', () => {
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: contextItemId }), null)
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: contextItemId }, knownItemIds), null)
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: null }), 'work-requires-context')
  assert.equal(noteContextViolation({ note_type: 'work' }), 'missing-context-key')
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: 'item-sem-uuid' }), 'invalid-context-reference')
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: '' }), 'invalid-context-reference')
  assert.equal(noteContextViolation({ note_type: 'work', context_item_id: unknownItemId }, knownItemIds), 'unknown-context-item')
})

test('D-001: reading aceita null ou Item existente', () => {
  assert.equal(noteContextViolation({ note_type: 'reading', context_item_id: null }), null)
  assert.equal(noteContextViolation({ note_type: 'reading', context_item_id: null }, knownItemIds), null)
  assert.equal(noteContextViolation({ note_type: 'reading', context_item_id: contextItemId }, knownItemIds), null)
  assert.equal(noteContextViolation({ note_type: 'reading' }), 'missing-context-key')
  assert.equal(noteContextViolation({ note_type: 'reading', context_item_id: 42 }), 'invalid-context-reference')
  assert.equal(noteContextViolation({ note_type: 'reading', context_item_id: unknownItemId }, knownItemIds), 'unknown-context-item')
})

test('D-001: permanent exige context_item_id null', () => {
  assert.equal(noteContextViolation({ note_type: 'permanent', context_item_id: null }), null)
  assert.equal(
    noteContextViolation({ note_type: 'permanent', context_item_id: contextItemId }, knownItemIds),
    'permanent-requires-null-context'
  )
  assert.equal(noteContextViolation({ note_type: 'permanent', context_item_id: '' }), 'permanent-requires-null-context')
  assert.equal(noteContextViolation({ note_type: 'permanent' }), 'missing-context-key')
})

test('D-001: tipo desconhecido é rejeitado e a validação não modifica a nota', () => {
  assert.equal(noteContextViolation({ note_type: 'project', context_item_id: null }), 'unknown-note-type')
  assert.equal(noteContextViolation({ context_item_id: null }), 'unknown-note-type')

  const note = Object.freeze({ note_type: 'work', context_item_id: contextItemId, title: 'Nota' })
  const before = structuredClone(note)
  assert.equal(noteContextViolation(note, knownItemIds), null)
  assert.deepEqual(note, before)
})
