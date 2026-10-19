// Modelo V1 (DATA_MODEL §3–§9, schema_version 1 congelado pela D-020).
// Módulo puro: sem Node nem DOM, usado pelo processo principal e pelo renderer.

export const SCHEMA_VERSION = 1

export const ITEM_TYPES = ['project', 'course', 'interest', 'idea', 'learning_path', 'goal'] as const
export const ITEM_STATUSES = ['backlog', 'planned', 'active', 'paused', 'completed', 'archived'] as const
export const PRIORITIES = ['low', 'medium', 'high'] as const
export const PROGRESS_MODES = ['tasks', 'manual', 'none'] as const
export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'canceled'] as const
export const NOTE_TYPES = ['work', 'reading', 'permanent'] as const
export const CAPTURE_KINDS = ['thought', 'link', 'task', 'project', 'course', 'note', 'undecided'] as const
export const CAPTURE_STATUSES = ['pending', 'processed', 'archived'] as const
export const CONVERSION_TYPES = [...ITEM_TYPES, 'task', 'note'] as const

export type ItemType = (typeof ITEM_TYPES)[number]
export type ItemStatus = (typeof ITEM_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type ProgressMode = (typeof PROGRESS_MODES)[number]
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type NoteType = (typeof NOTE_TYPES)[number]
export type CaptureKind = (typeof CAPTURE_KINDS)[number]
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number]
export type ConversionType = (typeof CONVERSION_TYPES)[number]

export type EntityKind = 'group' | 'tag' | 'item' | 'task' | 'note' | 'capture'

export interface CommonFields {
  id: string
  schema_version: number
  title: string
  created_at: string
  updated_at: string
  archived_at: string | null
  [key: string]: unknown
}

export interface Group extends CommonFields {
  description?: string
  color?: string | null
  icon?: string | null
  tag_ids: string[]
  sort_order: number
}

export interface Tag extends CommonFields {
  description?: string
  color?: string | null
  aliases?: string[]
}

export interface Item extends CommonFields {
  type: ItemType
  tag_ids: string[]
  status: ItemStatus
  priority?: Priority
  summary?: string
  start_date?: string | null
  target_date?: string | null
  external_url?: string | null
  provider?: string | null
  progress_mode: ProgressMode
  manual_progress: number | null
  objective?: string | null
  success_criteria?: string[]
  origin_capture_id?: string | null
}

export interface Task extends CommonFields {
  status: TaskStatus
  project_id: string | null
  is_next_action: boolean
  due_date?: string | null
  priority?: Priority
  sort_order: number
  completed_at: string | null
  origin_capture_id?: string | null
}

export interface Note extends CommonFields {
  note_type: NoteType
  context_item_id: string | null
  tag_ids: string[]
  aliases?: string[]
  source_title?: string | null
  source_author?: string | null
  source_url?: string | null
  source_year?: number | null
  origin_capture_id?: string | null
}

export interface InboxCapture {
  id: string
  schema_version: number
  title?: string | null
  capture_kind: CaptureKind
  status: CaptureStatus
  captured_at: string
  processed_at: string | null
  archived_at: string | null
  converted_to_type: ConversionType | null
  converted_to_id: string | null
  [key: string]: unknown
}

export interface EntityByKind {
  group: Group
  tag: Tag
  item: Item
  task: Task
  note: Note
  capture: InboxCapture
}

export type AnyEntity = EntityByKind[EntityKind]

// Pasta canônica (relativa à raiz, separador '/') de cada tipo. Notas dependem de note_type.
export function folderFor(kind: EntityKind, noteType?: NoteType): string {
  switch (kind) {
    case 'group': return 'groups'
    case 'tag': return 'tags'
    case 'item': return 'items'
    case 'task': return 'tasks'
    case 'capture': return 'inbox'
    case 'note':
      if (!noteType) throw new Error('note_type is required to resolve a note folder')
      return `notes/${noteType}`
  }
}

export const RECORD_FOLDERS: ReadonlyArray<{ folder: string; kind: EntityKind; noteType?: NoteType }> = [
  { folder: 'groups', kind: 'group' },
  { folder: 'tags', kind: 'tag' },
  { folder: 'items', kind: 'item' },
  { folder: 'tasks', kind: 'task' },
  { folder: 'notes/work', kind: 'note', noteType: 'work' },
  { folder: 'notes/reading', kind: 'note', noteType: 'reading' },
  { folder: 'notes/permanent', kind: 'note', noteType: 'permanent' },
  { folder: 'inbox', kind: 'capture' }
]

export function recordPath(kind: EntityKind, id: string, noteType?: NoteType): string {
  return `${folderFor(kind, noteType)}/${id}.md`
}

// Defaults de criação do aplicativo (D-020). Não são defaults de leitura.
export function defaultProgressMode(type: ItemType): ProgressMode {
  if (type === 'project') return 'tasks'
  if (type === 'interest' || type === 'idea') return 'none'
  return 'manual'
}

export const LABELS = {
  itemType: { project: 'Projeto', course: 'Curso', interest: 'Interesse', idea: 'Ideia', learning_path: 'Trilha de aprendizado', goal: 'Meta' } satisfies Record<ItemType, string>,
  itemStatus: { backlog: 'Backlog', planned: 'Planejado', active: 'Ativo', paused: 'Pausado', completed: 'Concluído', archived: 'Arquivado' } satisfies Record<ItemStatus, string>,
  priority: { low: 'Baixa', medium: 'Média', high: 'Alta' } satisfies Record<Priority, string>,
  progressMode: { tasks: 'Pelas tarefas', manual: 'Manual', none: 'Sem progresso' } satisfies Record<ProgressMode, string>,
  taskStatus: { todo: 'A fazer', in_progress: 'Em andamento', done: 'Concluída', canceled: 'Cancelada' } satisfies Record<TaskStatus, string>,
  noteType: { work: 'Trabalho', reading: 'Leitura', permanent: 'Permanente' } satisfies Record<NoteType, string>,
  captureKind: { thought: 'Pensamento', link: 'Link', task: 'Tarefa', project: 'Projeto', course: 'Curso', note: 'Nota', undecided: 'Indefinido' } satisfies Record<CaptureKind, string>,
  captureStatus: { pending: 'Pendente', processed: 'Processada', archived: 'Arquivada' } satisfies Record<CaptureStatus, string>
}
