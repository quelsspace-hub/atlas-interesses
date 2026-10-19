import { isUuidV4 } from './identity.js'

export interface TagMembershipSlice {
  readonly tag_ids: readonly string[]
}

export type ProgressTaskStatus = 'todo' | 'in_progress' | 'done' | 'canceled'

export interface ProgressTaskSlice {
  readonly project_id: string | null
  readonly status: ProgressTaskStatus
}

export function itemBelongsToGroup(
  item: TagMembershipSlice,
  group: TagMembershipSlice
): boolean {
  const itemTagIds = new Set(item.tag_ids)
  return group.tag_ids.some((tagId) => itemTagIds.has(tagId))
}

export function calculateProjectProgress(
  projectId: string,
  tasks: readonly ProgressTaskSlice[]
): number | null {
  let eligible = 0
  let done = 0

  for (const task of tasks) {
    if (task.project_id !== projectId || task.status === 'canceled') continue
    eligible += 1
    if (task.status === 'done') done += 1
  }

  return eligible === 0 ? null : (100 * done) / eligible
}

export interface NoteContextSlice {
  readonly note_type?: unknown
  readonly context_item_id?: unknown
}

export type NoteContextViolation =
  | 'unknown-note-type'
  | 'missing-context-key'
  | 'work-requires-context'
  | 'permanent-requires-null-context'
  | 'invalid-context-reference'
  | 'unknown-context-item'

// D-001: work exige Item; reading aceita Item ou null; permanent exige null.
// knownItemIds, quando informado, verifica existência; sem ele só a forma é verificada.
export function noteContextViolation(
  note: NoteContextSlice,
  knownItemIds?: ReadonlySet<string>
): NoteContextViolation | null {
  const noteType = note.note_type
  if (noteType !== 'work' && noteType !== 'reading' && noteType !== 'permanent') return 'unknown-note-type'
  if (!Object.hasOwn(note, 'context_item_id')) return 'missing-context-key'

  const contextItemId = note.context_item_id
  if (noteType === 'permanent') return contextItemId === null ? null : 'permanent-requires-null-context'
  if (contextItemId === null) return noteType === 'work' ? 'work-requires-context' : null
  if (!isUuidV4(contextItemId)) return 'invalid-context-reference'
  if (knownItemIds && !knownItemIds.has(contextItemId)) return 'unknown-context-item'
  return null
}