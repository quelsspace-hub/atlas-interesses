import { extractLinks, type LinkRef } from './links.js'
import type { EntityKind, Group, InboxCapture, Item, Note, Tag, Task } from './model.js'
import type { Problem } from './validate.js'

// Registro como o renderer o recebe (sem bytes; o corpo original fica no processo principal).
export interface RecordView<K extends EntityKind = EntityKind> {
  kind: K
  id: string
  path: string
  revision: string
  metadata: K extends 'group' ? Group : K extends 'tag' ? Tag : K extends 'item' ? Item : K extends 'task' ? Task : K extends 'note' ? Note : InboxCapture
  body: string
  problems: Problem[]
}

export interface VaultIndex {
  groups: RecordView<'group'>[]
  tags: RecordView<'tag'>[]
  items: RecordView<'item'>[]
  tasks: RecordView<'task'>[]
  notes: RecordView<'note'>[]
  captures: RecordView<'capture'>[]
  byId: Map<string, RecordView>
  outgoing: Map<string, LinkRef[]>
  backlinks: Map<string, string[]>
}

const byOrder = (a: { metadata: { sort_order: number; title: string } }, b: { metadata: { sort_order: number; title: string } }) =>
  a.metadata.sort_order - b.metadata.sort_order || a.metadata.title.localeCompare(b.metadata.title, 'pt-BR')
const byTitle = (a: { metadata: { title?: string | null } }, b: { metadata: { title?: string | null } }) =>
  (a.metadata.title ?? '').localeCompare(b.metadata.title ?? '', 'pt-BR')

export function buildIndex(records: readonly RecordView[]): VaultIndex {
  const valid = records.filter((r) => !r.problems.some((p) => p.severity === 'error'))
  const of = <K extends EntityKind>(kind: K) => valid.filter((r): r is RecordView<K> => r.kind === kind)
  const index: VaultIndex = {
    groups: of('group').sort(byOrder),
    tags: of('tag').sort(byTitle),
    items: of('item').sort(byTitle),
    tasks: of('task').sort(byOrder),
    notes: of('note').sort(byTitle),
    captures: of('capture').sort((a, b) => b.metadata.captured_at.localeCompare(a.metadata.captured_at)),
    byId: new Map(valid.map((r) => [r.id, r])),
    outgoing: new Map(),
    backlinks: new Map()
  }
  const known = new Set(valid.map((r) => r.path))
  for (const record of valid) {
    const links = extractLinks(record.path, record.body, known)
    index.outgoing.set(record.id, links)
    for (const link of links) {
      if (link.kind !== 'record' || !link.targetId || link.targetId === record.id) continue
      const list = index.backlinks.get(link.targetId) ?? []
      if (!list.includes(record.id)) list.push(record.id)
      index.backlinks.set(link.targetId, list)
    }
  }
  return index
}

// D-004: um Item pertence ao grupo se compartilha ao menos uma Tag (OR).
export function sharesTag(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  const set = new Set(a)
  return b.some((id) => set.has(id))
}

export const groupItems = (index: VaultIndex, group: Group): RecordView<'item'>[] => index.items.filter((i) => sharesTag(group.tag_ids, i.metadata.tag_ids))
export const itemGroups = (index: VaultIndex, item: Item): RecordView<'group'>[] => index.groups.filter((g) => sharesTag(g.metadata.tag_ids, item.tag_ids))
// D-024: notas por interseção de tags, em seção separada (não contam como Items).
export const groupNotes = (index: VaultIndex, group: Group): RecordView<'note'>[] => index.notes.filter((n) => sharesTag(group.tag_ids, n.metadata.tag_ids))
export const ungroupedItems = (index: VaultIndex): RecordView<'item'>[] => index.items.filter((i) => itemGroups(index, i.metadata).length === 0)

export const projectTasks = (index: VaultIndex, projectId: string): RecordView<'task'>[] => index.tasks.filter((t) => t.metadata.project_id === projectId)
export const itemNotes = (index: VaultIndex, itemId: string): RecordView<'note'>[] => index.notes.filter((n) => n.metadata.context_item_id === itemId)

// D-003 + D-022: progresso por tarefas elegíveis (todo, in_progress, done, inclusive arquivadas);
// canceled excluída; sem elegíveis → null. Percentual nunca conclui o projeto sozinho.
export function taskProgress(tasks: readonly Pick<Task, 'status'>[]): number | null {
  const eligible = tasks.filter((t) => t.status !== 'canceled')
  if (eligible.length === 0) return null
  return Math.round((eligible.filter((t) => t.status === 'done').length / eligible.length) * 100)
}

export function itemProgress(index: VaultIndex, item: Item): number | null {
  if (item.progress_mode === 'manual') return item.manual_progress
  if (item.progress_mode === 'none') return null
  return taskProgress(projectTasks(index, item.id).map((t) => t.metadata))
}

export function nextSortOrder(records: readonly { metadata: { sort_order: number } }[]): number {
  return records.length === 0 ? 0 : Math.max(...records.map((r) => r.metadata.sort_order)) + 1
}

// Data local AAAA-MM-DD (prazos sem horário não são convertidos para UTC).
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const isOpenTask = (t: Task) => t.archived_at === null && (t.status === 'todo' || t.status === 'in_progress')
export const isOverdue = (t: Task, day = today()) => isOpenTask(t) && !!t.due_date && t.due_date < day
