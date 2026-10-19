import {
  CAPTURE_KINDS, CAPTURE_STATUSES, CONVERSION_TYPES, ITEM_STATUSES, ITEM_TYPES, NOTE_TYPES, PRIORITIES, PROGRESS_MODES,
  SCHEMA_VERSION, TASK_STATUSES, type EntityKind, type NoteType
} from './model.js'

// Validação estrutural de um registro (DATA_MODEL §3–§9). "error" torna o registro inválido
// (não é regravado nem exportado); "warning" é diagnóstico de coerência, sem bloquear.
export interface Problem {
  severity: 'error' | 'warning'
  field?: string
  code: string
  message: string
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/
const dateOnly = /^\d{4}-\d{2}-\d{2}$/
const hexColor = /^#[0-9A-Fa-f]{6}$/

export const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidV4.test(value)
export const isTimestamp = (value: unknown): value is string => typeof value === 'string' && timestamp.test(value) && !Number.isNaN(Date.parse(value))
export const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !dateOnly.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y!, m! - 1, d!))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m! - 1 && parsed.getUTCDate() === d
}

class Checker {
  readonly problems: Problem[] = []
  constructor(private readonly meta: Record<string, unknown>) {}

  error(field: string | undefined, code: string, message: string): void { this.problems.push({ severity: 'error', field, code, message }) }
  warn(field: string | undefined, code: string, message: string): void { this.problems.push({ severity: 'warning', field, code, message }) }
  has(field: string): boolean { return Object.prototype.hasOwnProperty.call(this.meta, field) }
  get(field: string): unknown { return this.meta[field] }

  required(field: string): boolean {
    if (!this.has(field)) { this.error(field, 'missing', `campo obrigatório ausente: ${field}`); return false }
    return true
  }

  string(field: string, opts: { required?: boolean; nullable?: boolean; nonEmpty?: boolean } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    const value = this.get(field)
    if (value === null) { if (!opts.nullable) this.error(field, 'type', `${field} não pode ser null`); return }
    if (typeof value !== 'string') { this.error(field, 'type', `${field} deve ser texto`); return }
    if (opts.nonEmpty && value.trim().length === 0) this.error(field, 'empty', `${field} não pode ficar vazio`)
  }

  pattern(field: string, test: (v: unknown) => boolean, label: string, opts: { required?: boolean; nullable?: boolean } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    const value = this.get(field)
    if (value === null) { if (!opts.nullable) this.error(field, 'type', `${field} não pode ser null`); return }
    if (!test(value)) this.error(field, 'format', `${field} deve ser ${label}`)
  }

  enumeration(field: string, values: readonly string[], opts: { required?: boolean; nullable?: boolean } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    const value = this.get(field)
    if (value === null) { if (!opts.nullable) this.error(field, 'type', `${field} não pode ser null`); return }
    if (typeof value !== 'string' || !values.includes(value)) this.error(field, 'enum', `${field} deve ser um de: ${values.join(', ')}`)
  }

  integer(field: string, opts: { required?: boolean; nullable?: boolean; min?: number; max?: number } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    const value = this.get(field)
    if (value === null) { if (!opts.nullable) this.error(field, 'type', `${field} não pode ser null`); return }
    if (typeof value !== 'number' || !Number.isInteger(value)) { this.error(field, 'type', `${field} deve ser inteiro`); return }
    if ((opts.min !== undefined && value < opts.min) || (opts.max !== undefined && value > opts.max)) {
      this.error(field, 'range', `${field} fora do intervalo ${opts.min ?? '-∞'}–${opts.max ?? '∞'}`)
    }
  }

  boolean(field: string, opts: { required?: boolean } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    if (typeof this.get(field) !== 'boolean') this.error(field, 'type', `${field} deve ser true ou false`)
  }

  uuidList(field: string, opts: { required?: boolean } = {}): void {
    if (!this.has(field)) { if (opts.required) this.required(field); return }
    const value = this.get(field)
    if (!Array.isArray(value)) { this.error(field, 'type', `${field} deve ser uma lista`); return }
    if (!value.every(isUuid)) { this.error(field, 'format', `${field} deve conter apenas UUID v4`); return }
    if (new Set(value).size !== value.length) this.error(field, 'duplicate', `${field} contém UUIDs repetidos`)
  }

  stringList(field: string): void {
    if (!this.has(field)) return
    const value = this.get(field)
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) this.error(field, 'type', `${field} deve ser uma lista de textos`)
  }
}

function common(c: Checker, titleRequired: boolean): void {
  c.pattern('id', isUuid, 'UUID v4', { required: true })
  if (c.required('schema_version')) {
    const version = c.get('schema_version')
    if (version !== SCHEMA_VERSION) c.error('schema_version', typeof version === 'number' && Number.isInteger(version) ? 'unsupported-version' : 'type', `schema_version ${String(version)} não é suportada (suportada: ${SCHEMA_VERSION})`)
  }
  if (titleRequired) {
    c.string('title', { required: true, nonEmpty: true })
    c.pattern('created_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true })
    c.pattern('updated_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true })
    c.pattern('archived_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true, nullable: true })
  }
}

export function validateEntity(kind: EntityKind, value: unknown, folderNoteType?: NoteType): Problem[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [{ severity: 'error', code: 'type', message: 'o frontmatter deve ser um mapeamento YAML' }]
  }
  const meta = value as Record<string, unknown>
  const c = new Checker(meta)

  switch (kind) {
    case 'group':
      common(c, true)
      c.string('description')
      c.pattern('color', (v) => typeof v === 'string' && hexColor.test(v), 'cor #RRGGBB', { nullable: true })
      c.string('icon', { nullable: true })
      c.uuidList('tag_ids', { required: true })
      c.integer('sort_order', { required: true })
      break
    case 'tag':
      common(c, true)
      c.string('description')
      c.pattern('color', (v) => typeof v === 'string' && hexColor.test(v), 'cor #RRGGBB', { nullable: true })
      c.stringList('aliases')
      break
    case 'item': {
      common(c, true)
      c.enumeration('type', ITEM_TYPES, { required: true })
      c.uuidList('tag_ids', { required: true })
      c.enumeration('status', ITEM_STATUSES, { required: true })
      c.enumeration('priority', PRIORITIES)
      c.string('summary')
      c.pattern('start_date', isDate, 'data AAAA-MM-DD', { nullable: true })
      c.pattern('target_date', isDate, 'data AAAA-MM-DD', { nullable: true })
      c.string('external_url', { nullable: true })
      c.string('provider', { nullable: true })
      c.enumeration('progress_mode', PROGRESS_MODES, { required: true })
      if (c.required('manual_progress')) {
        const mode = meta.progress_mode
        if (mode === 'manual') c.integer('manual_progress', { min: 0, max: 100 })
        else if (meta.manual_progress !== null) c.error('manual_progress', 'nullability', 'manual_progress deve ser null fora do modo manual')
      }
      if (meta.progress_mode === 'tasks' && meta.type !== undefined && meta.type !== 'project') c.error('progress_mode', 'rule', 'progresso por tarefas só é válido para projetos')
      c.string('objective', { nullable: true })
      c.stringList('success_criteria')
      c.pattern('origin_capture_id', isUuid, 'UUID v4', { nullable: true })
      if (isDate(meta.start_date) && isDate(meta.target_date) && meta.target_date < meta.start_date) c.warn('target_date', 'order', 'prazo-alvo anterior ao início')
      if ((meta.status === 'archived') !== (meta.archived_at !== null && meta.archived_at !== undefined)) c.warn('archived_at', 'coherence', 'status archived e archived_at devem andar juntos')
      break
    }
    case 'task':
      common(c, true)
      c.enumeration('status', TASK_STATUSES, { required: true })
      c.pattern('project_id', isUuid, 'UUID v4', { required: true, nullable: true })
      c.boolean('is_next_action', { required: true })
      c.pattern('due_date', isDate, 'data AAAA-MM-DD', { nullable: true })
      c.enumeration('priority', PRIORITIES)
      c.integer('sort_order', { required: true })
      c.pattern('completed_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true, nullable: true })
      c.pattern('origin_capture_id', isUuid, 'UUID v4', { nullable: true })
      if (meta.status === 'done' && meta.completed_at === null) c.warn('completed_at', 'coherence', 'tarefa concluída sem completed_at')
      if (meta.status !== 'done' && meta.completed_at !== null && meta.completed_at !== undefined) c.warn('completed_at', 'coherence', 'completed_at preenchido em tarefa não concluída')
      break
    case 'note':
      common(c, true)
      c.enumeration('note_type', NOTE_TYPES, { required: true })
      c.pattern('context_item_id', isUuid, 'UUID v4', { required: true, nullable: true })
      c.uuidList('tag_ids', { required: true })
      c.stringList('aliases')
      c.string('source_title', { nullable: true })
      c.string('source_author', { nullable: true })
      c.string('source_url', { nullable: true })
      c.integer('source_year', { nullable: true })
      c.pattern('origin_capture_id', isUuid, 'UUID v4', { nullable: true })
      if (folderNoteType && meta.note_type !== undefined && meta.note_type !== folderNoteType) c.error('note_type', 'folder', `note_type ${String(meta.note_type)} não corresponde à pasta notes/${folderNoteType}`)
      // D-001
      if (meta.note_type === 'work' && meta.context_item_id === null) c.error('context_item_id', 'D-001', 'nota de trabalho exige contexto')
      if (meta.note_type === 'permanent' && meta.context_item_id !== null && meta.context_item_id !== undefined) c.error('context_item_id', 'D-001', 'nota permanente não tem contexto')
      break
    case 'capture':
      common(c, false)
      c.string('title', { nullable: true })
      c.enumeration('capture_kind', CAPTURE_KINDS, { required: true })
      c.enumeration('status', CAPTURE_STATUSES, { required: true })
      c.pattern('captured_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true })
      c.pattern('processed_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true, nullable: true })
      c.pattern('archived_at', isTimestamp, 'timestamp ISO-8601 UTC', { required: true, nullable: true })
      c.enumeration('converted_to_type', CONVERSION_TYPES, { required: true, nullable: true })
      c.pattern('converted_to_id', isUuid, 'UUID v4', { required: true, nullable: true })
      if ((meta.converted_to_type === null) !== (meta.converted_to_id === null)) c.error('converted_to_id', 'coherence', 'converted_to_type e converted_to_id são nulos juntos')
      if (meta.status === 'pending' && (meta.processed_at !== null || meta.converted_to_id !== null)) c.warn('status', 'coherence', 'captura pendente com dados de conversão')
      if (meta.status === 'processed' && (meta.processed_at === null || meta.converted_to_id === null)) c.warn('status', 'coherence', 'captura processada sem resultado registrado')
      break
  }
  return c.problems
}

export const hasErrors = (problems: readonly Problem[]): boolean => problems.some((p) => p.severity === 'error')
