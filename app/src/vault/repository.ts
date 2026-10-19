import { randomUUID } from 'node:crypto'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { TextDecoder } from 'node:util'
import { NodeFileStorage } from './adapters/node-storage.js'
import { DestinationExistsError, FrontmatterDiagnosticError, StorageFailureError, UncertainWriteError, WriteConflictError } from './core/errors.js'
import { createRecord, readRecord, replaceRecord, type RecordSnapshot } from './core/record.js'
import type { StoragePort } from './core/storage-port.js'
import { encodeBody, encodeRecord } from './serialize.js'
import { RECORD_FOLDERS, SCHEMA_VERSION, folderFor, type EntityKind, type NoteType } from '../domain/model.js'
import { hasErrors, isUuid, validateEntity, type Problem } from '../domain/validate.js'
import type { RecordView } from '../domain/derive.js'

const recordName = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/
const temporaryName = /^\.tmp-[0-9a-f-]{36}\.md$/
const transactionName = /^\.txn_[0-9a-f-]{36}\.json$/
const utf8 = new TextDecoder('utf-8', { fatal: false })

export class VaultError extends Error {
  constructor(readonly code: 'conflict' | 'exists' | 'invalid' | 'not-found' | 'storage' | 'uncertain', message: string, readonly details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VaultError'
  }
}

interface Entry {
  kind: EntityKind
  relPath: string
  snapshot: RecordSnapshot | null
  problems: Problem[]
}

export interface LoadReport {
  invalid: Array<{ path: string; problems: Problem[] }>
  temporaries: string[]
  transactions: string[]
}

export class VaultRepository {
  private entries = new Map<string, Entry>()
  private invalidFiles: Array<{ path: string; problems: Problem[] }> = []
  private temporaries: string[] = []
  private transactions: string[] = []

  constructor(readonly root: string, readonly storage: StoragePort = new NodeFileStorage(), private readonly clock: () => Date = () => new Date()) {}

  abs(relPath: string): string {
    return join(this.root, ...relPath.split('/'))
  }

  async ensureStructure(): Promise<void> {
    for (const { folder } of RECORD_FOLDERS) await mkdir(this.abs(folder), { recursive: true })
    await mkdir(this.abs('assets'), { recursive: true })
  }

  async load(): Promise<LoadReport> {
    this.entries = new Map()
    this.invalidFiles = []
    this.temporaries = []
    this.transactions = []
    for (const { folder, kind, noteType } of RECORD_FOLDERS) {
      let names: string[]
      try {
        names = (await readdir(this.abs(folder), { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name).sort()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      for (const name of names) {
        const relPath = `${folder}/${name}`
        if (temporaryName.test(name)) { this.temporaries.push(relPath); continue }
        if (kind === 'capture' && transactionName.test(name)) { this.transactions.push(relPath); continue }
        const match = recordName.exec(name)
        if (!match) continue // conteúdo não canônico (E-C); não é validado como registro
        await this.loadOne(kind, relPath, match[1]!, noteType)
      }
    }
    this.checkReferences()
    return this.report()
  }

  report(): LoadReport {
    return { invalid: [...this.invalidFiles], temporaries: [...this.temporaries], transactions: [...this.transactions] }
  }

  private async loadOne(kind: EntityKind, relPath: string, fileId: string, noteType?: NoteType): Promise<void> {
    let snapshot: RecordSnapshot
    try {
      snapshot = await readRecord(this.abs(relPath), this.storage)
    } catch (error) {
      const message = error instanceof FrontmatterDiagnosticError ? error.diagnostics.join('; ') : String((error as Error).message ?? error)
      this.invalidFiles.push({ path: relPath, problems: [{ severity: 'error', code: 'frontmatter', message }] })
      return
    }
    const problems = validateEntity(kind, snapshot.metadata, noteType)
    if (snapshot.metadata.id !== fileId) problems.push({ severity: 'error', field: 'id', code: 'filename', message: 'o nome do arquivo deve ser {id}.md' })
    if (this.entries.has(fileId)) problems.push({ severity: 'error', field: 'id', code: 'duplicate', message: `UUID repetido em ${this.entries.get(fileId)!.relPath}` })
    if (hasErrors(problems)) {
      this.invalidFiles.push({ path: relPath, problems })
      return
    }
    this.entries.set(fileId, { kind, relPath, snapshot, problems })
  }

  // Referências ausentes geram diagnóstico, não exclusão (DATA_MODEL §1).
  private checkReferences(): void {
    for (const entry of this.entries.values()) {
      entry.problems = entry.problems.filter((p) => p.code !== 'reference')
      for (const problem of this.referenceProblems(entry.kind, entry.snapshot!.metadata)) entry.problems.push({ ...problem, severity: 'warning' })
    }
  }

  // `pending` permite referências a registros da mesma transação ainda não gravados.
  referenceProblems(kind: EntityKind, meta: Record<string, unknown>, pending?: ReadonlyMap<string, { kind: EntityKind; metadata: Record<string, unknown> }>): Problem[] {
    const problems: Problem[] = []
    const lookup = (id: string): Entry | undefined => {
      const found = this.entries.get(id)
      if (found) return found
      const p = pending?.get(id)
      return p ? { kind: p.kind, relPath: '', snapshot: { metadata: p.metadata } as RecordSnapshot, problems: [] } : undefined
    }
    const expect = (field: string, id: unknown, wanted: EntityKind, extra?: (e: Entry) => string | null) => {
      if (!isUuid(id)) return
      const target = lookup(id)
      if (!target || target.kind !== wanted) { problems.push({ severity: 'error', field, code: 'reference', message: `${field} aponta para ${wanted} inexistente (${id})` }); return }
      const message = extra?.(target)
      if (message) problems.push({ severity: 'error', field, code: 'reference', message })
    }
    for (const id of Array.isArray(meta.tag_ids) ? meta.tag_ids : []) expect('tag_ids', id, 'tag')
    if (kind === 'task') expect('project_id', meta.project_id, 'item', (e) => e.snapshot!.metadata.type === 'project' ? null : 'project_id deve apontar para um Item do tipo project')
    if (kind === 'note') expect('context_item_id', meta.context_item_id, 'item')
    if (kind === 'capture' && meta.converted_to_id) {
      const target = lookup(meta.converted_to_id as string)
      if (!target) problems.push({ severity: 'error', field: 'converted_to_id', code: 'reference', message: 'resultado da conversão não encontrado' })
    }
    return problems
  }

  views(): RecordView[] {
    return [...this.entries.entries()].map(([id, e]) => this.view(id, e))
  }

  private view(id: string, e: Entry): RecordView {
    return { kind: e.kind, id, path: e.relPath, revision: e.snapshot!.revision, metadata: e.snapshot!.metadata as never, body: utf8.decode(e.snapshot!.body), problems: e.problems }
  }

  get(id: string): { kind: EntityKind; relPath: string; snapshot: RecordSnapshot } | undefined {
    const e = this.entries.get(id)
    return e && e.snapshot ? { kind: e.kind, relPath: e.relPath, snapshot: e.snapshot } : undefined
  }

  // Prepara metadados e bytes de um novo registro sem gravar (usado também pela transação da Inbox).
  prepareNew(
    kind: EntityKind,
    input: Record<string, unknown>,
    bodyText: string,
    id: string = randomUUID(),
    pending?: ReadonlyMap<string, { kind: EntityKind; metadata: Record<string, unknown> }>
  ): { id: string; relPath: string; metadata: Record<string, unknown>; bytes: Buffer } {
    const now = this.clock().toISOString()
    const metadata: Record<string, unknown> = kind === 'capture'
      ? { ...input, id, schema_version: SCHEMA_VERSION }
      : { ...input, id, schema_version: SCHEMA_VERSION, created_at: now, updated_at: now, archived_at: input.archived_at ?? null }
    if (kind === 'capture' && metadata.captured_at === undefined) metadata.captured_at = now
    const noteType = kind === 'note' ? (metadata.note_type as NoteType) : undefined
    const problems = [...validateEntity(kind, metadata, noteType), ...this.referenceProblems(kind, metadata, pending)]
    if (hasErrors(problems)) throw new VaultError('invalid', problems.filter((p) => p.severity === 'error').map((p) => p.message).join('; '), { problems })
    if (this.entries.has(id)) throw new VaultError('exists', 'UUID já usado no vault.')
    const relPath = `${folderFor(kind, noteType)}/${id}.md`
    const body = encodeBody(bodyText.length > 0 && !bodyText.startsWith('\n') ? `\n${bodyText}` : bodyText)
    return { id, relPath, metadata, bytes: encodeRecord(metadata, body) }
  }

  async create(kind: EntityKind, input: Record<string, unknown>, bodyText = ''): Promise<RecordView> {
    const prepared = this.prepareNew(kind, input, bodyText)
    await mkdir(this.abs(prepared.relPath.slice(0, prepared.relPath.lastIndexOf('/'))), { recursive: true })
    let snapshot: RecordSnapshot
    try {
      snapshot = await createRecord(this.abs(prepared.relPath), prepared.bytes, this.storage)
    } catch (error) {
      throw translate(error)
    }
    this.adopt(prepared.id, kind, prepared.relPath, snapshot)
    return this.view(prepared.id, this.entries.get(prepared.id)!)
  }

  adopt(id: string, kind: EntityKind, relPath: string, snapshot: RecordSnapshot): void {
    const noteType = kind === 'note' ? (snapshot.metadata.note_type as NoteType) : undefined
    const problems = validateEntity(kind, snapshot.metadata, noteType)
    this.entries.set(id, { kind, relPath, snapshot, problems })
    this.checkReferences()
  }

  // Edição: `metadata` completo (campos desconhecidos preservados por quem chama). `bodyText` undefined
  // significa edição só de metadados: os bytes originais do corpo são anexados sem alteração (D-006).
  async update(id: string, revision: string, metadata: Record<string, unknown>, bodyText?: string): Promise<RecordView> {
    const current = this.entries.get(id)
    if (!current?.snapshot) throw new VaultError('not-found', `registro ${id} não encontrado`)
    if (current.snapshot.revision !== revision) {
      throw new VaultError('conflict', 'O registro mudou desde que foi aberto.', { path: current.relPath, external: utf8.decode(current.snapshot.bytes) })
    }
    if (metadata.id !== id) throw new VaultError('invalid', 'o UUID é imutável (D-005)')
    const next: Record<string, unknown> = { ...metadata, schema_version: current.snapshot.metadata.schema_version }
    if (current.kind !== 'capture') {
      next.created_at = current.snapshot.metadata.created_at
      next.updated_at = this.clock().toISOString()
    }
    const noteType = current.kind === 'note' ? (current.snapshot.metadata.note_type as NoteType) : undefined
    if (current.kind === 'note' && next.note_type !== noteType) throw new VaultError('invalid', 'mudar note_type exigiria mover o arquivo; crie uma nova nota (D-008)')
    const problems = [...validateEntity(current.kind, next, noteType), ...this.referenceProblems(current.kind, next)]
    if (hasErrors(problems)) throw new VaultError('invalid', problems.filter((p) => p.severity === 'error').map((p) => p.message).join('; '), { problems })
    const body = bodyText === undefined ? current.snapshot.body : encodeBody(bodyText, current.snapshot.body)
    const bytes = encodeRecord(next, body, Object.keys(current.snapshot.metadata))
    let snapshot: RecordSnapshot
    try {
      snapshot = await replaceRecord(current.snapshot, bytes, this.storage)
    } catch (error) {
      throw translate(error)
    }
    this.adopt(id, current.kind, current.relPath, snapshot)
    return this.view(id, this.entries.get(id)!)
  }

  // Relê um registro do disco (após conflito, para comparar e decidir).
  async refresh(id: string): Promise<RecordView | null> {
    const current = this.entries.get(id)
    if (!current) return null
    const snapshot = await readRecord(this.abs(current.relPath), this.storage)
    this.adopt(id, current.kind, current.relPath, snapshot)
    return this.view(id, this.entries.get(id)!)
  }
}

export function translate(error: unknown): VaultError {
  if (error instanceof VaultError) return error
  if (error instanceof WriteConflictError) return new VaultError('conflict', 'O arquivo foi alterado fora do aplicativo. Nada foi sobrescrito.', { path: error.path, external: utf8.decode(error.externalBytes) })
  if (error instanceof DestinationExistsError) return new VaultError('exists', 'Já existe um arquivo com esse UUID; nada foi substituído.', { path: error.path })
  if (error instanceof UncertainWriteError) return new VaultError('uncertain', 'Não foi possível confirmar a gravação. Verifique o arquivo antes de continuar.', { path: error.path, tempPath: error.tempPath })
  if (error instanceof StorageFailureError) {
    const cause = (error as { cause?: NodeJS.ErrnoException }).cause
    return new VaultError('storage', `Falha de gravação (${cause?.code ?? error.operation}). Nada foi marcado como salvo.`, { path: error.path, errno: cause?.code })
  }
  return new VaultError('storage', String((error as Error)?.message ?? error))
}
