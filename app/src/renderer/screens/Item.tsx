import { useState } from 'react'
import { itemGroups, itemNotes, itemProgress, nextSortOrder, projectTasks, type RecordView } from '../../domain/derive.js'
import { ITEM_STATUSES, LABELS, PRIORITIES, PROGRESS_MODES, type Item, type ItemStatus, type NoteType, type ProgressMode } from '../../domain/model.js'
import { nowIso, useAtlas } from '../state.js'
import { BackButton, Button, ConflictDialog, Empty, MarkdownView, Modal, Progress, SaveBar, SelectField, TagPicker, TextArea, TextField, entries, routeFor, useRecordEditor } from '../ui.js'
import { TaskRow } from './Tasks.js'

export function BodyEditor({ body, setBody, fromPath, onAttach }: { body: string; setBody: (v: string) => void; fromPath: string; onAttach?: () => void }) {
  const [preview, setPreview] = useState(false)
  return (
    <section className="stack">
      <div className="spread">
        <div className="tabs" role="tablist" aria-label="Modo do corpo">
          <button role="tab" className="tab" aria-selected={!preview} onClick={() => setPreview(false)}>Editar</button>
          <button role="tab" className="tab" aria-selected={preview} onClick={() => setPreview(true)}>Pré-visualizar</button>
        </div>
        {onAttach && <Button small onClick={onAttach}>Anexar arquivo</Button>}
      </div>
      {preview
        ? <div className="card" style={{ minHeight: 200 }}>{body.trim() ? <MarkdownView source={body} fromPath={fromPath} /> : <p className="muted">Corpo vazio.</p>}</div>
        : <><label className="visually-hidden" htmlFor="body-editor">Corpo Markdown</label><textarea id="body-editor" className="input editor" value={body} onChange={(e) => setBody(e.target.value)} spellCheck /></>}
    </section>
  )
}

export function ItemScreen({ id }: { id: string }) {
  const { index, navigate, create, update, run } = useAtlas()
  const record = index?.byId.get(id) as RecordView<'item'> | undefined
  const editor = useRecordEditor<Item>(record, String(record?.metadata.title ?? 'Item'))
  const [unarchiving, setUnarchiving] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [criteria, setCriteria] = useState('')
  if (!index) return null
  if (!record || !editor.meta) return <div className="page"><Empty>Item não encontrado. <Button small onClick={() => navigate({ screen: 'atlas' })}>Voltar ao Atlas</Button></Empty></div>
  const m = editor.meta
  const tasks = projectTasks(index, id)
  const notes = itemNotes(index, id)
  const groups = itemGroups(index, m)
  const progress = itemProgress(index, m)
  const archived = m.status === 'archived'

  const setMode = (mode: ProgressMode) => editor.patch({ progress_mode: mode, manual_progress: mode === 'manual' ? (m.manual_progress ?? 0) : null })
  const archive = async () => {
    if (!editor.base) return
    if (editor.changed && !(await editor.save())) return
    const fresh = index.byId.get(id) as RecordView<'item'>
    await update(fresh, { ...fresh.metadata, status: 'archived', archived_at: nowIso() }, undefined, 'Item arquivado; referências preservadas.')
  }
  const unarchive = async (status: ItemStatus) => {
    const fresh = index.byId.get(id) as RecordView<'item'>
    const r = await update(fresh, { ...fresh.metadata, status, archived_at: null }, undefined, 'Item recuperado.')
    if (!('code' in r)) setUnarchiving(false)
  }
  const addTask = async () => {
    if (!newTask.trim()) return
    const r = await create('task', { title: newTask.trim(), status: 'todo', project_id: id, is_next_action: tasks.every((t) => !t.metadata.is_next_action), sort_order: nextSortOrder(index.tasks), completed_at: null }, '', 'Tarefa criada.')
    if (r) setNewTask('')
  }
  const newNote = async (noteType: NoteType) => {
    const r = await create('note', { title: `Nota sobre ${m.title}`, note_type: noteType, context_item_id: id, tag_ids: m.tag_ids, aliases: [] }, '', 'Nota criada.')
    if (r) navigate({ screen: 'note', id: r.id })
  }
  const attach = async () => {
    const r = await run(window.atlas.addAttachment(record.path))
    if (r) editor.setBody(`${editor.body}${editor.body.endsWith('\n') || !editor.body ? '' : '\n'}${r.markdown}\n`)
  }
  const criteriaList = m.success_criteria ?? []
  const targetBeforeStart = m.start_date && m.target_date && m.target_date < m.start_date

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <BackButton fallback={{ screen: m.type === 'project' ? 'projects' : 'atlas' }} />
          <span className="row"><span className="badge">{LABELS.itemType[m.type]}</span>{archived && <span className="badge archived">Arquivado</span>}</span>
        </div>
        <SaveBar editor={editor} />
      </div>
      {archived && <div className="banner">Este item está arquivado: fica fora das listas padrão, mas continua no vault e suas referências continuam válidas. <Button small onClick={() => setUnarchiving(true)}>Recuperar</Button></div>}
      <div className="detail">
        <div className="stack-m">
          <TextField label="Título" required value={m.title} onChange={(v) => editor.patch({ title: v })} error={!m.title.trim() ? 'O título não pode ficar vazio.' : undefined} />
          <TextField label="Resumo" value={m.summary ?? ''} onChange={(v) => editor.patch({ summary: v })} />
          <TextArea label="Objetivo" value={m.objective ?? ''} onChange={(v) => editor.patch({ objective: v || null })} rows={2} />
          <div className="field">
            <span>Critérios de sucesso</span>
            {criteriaList.length === 0 && <span className="muted body-s">Nenhum critério.</span>}
            {criteriaList.map((c, i) => (
              <div key={i} className="row">
                <input className="input" style={{ flex: 1 }} aria-label={`Critério ${i + 1}`} value={c} onChange={(e) => editor.patch({ success_criteria: criteriaList.map((x, j) => (j === i ? e.target.value : x)) })} />
                <Button small kind="ghost" aria-label={`Remover critério ${i + 1}`} onClick={() => editor.patch({ success_criteria: criteriaList.filter((_, j) => j !== i) })}>Remover</Button>
              </div>
            ))}
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (criteria.trim()) { editor.patch({ success_criteria: [...criteriaList, criteria.trim()] }); setCriteria('') } }}>
              <input className="input" style={{ flex: 1 }} aria-label="Novo critério" placeholder="Novo critério observável…" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
              <Button small type="submit" disabled={!criteria.trim()}>Adicionar</Button>
            </form>
          </div>
          <BodyEditor body={editor.body} setBody={editor.setBody} fromPath={record.path} onAttach={() => void attach()} />

          {m.type === 'project' && (
            <section className="stack">
              <h2>Tarefas</h2>
              <form className="row" onSubmit={(e) => { e.preventDefault(); void addTask() }}>
                <input className="input" style={{ flex: 1 }} aria-label="Nova tarefa do projeto" placeholder="Nova tarefa…" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
                <Button type="submit" disabled={!newTask.trim()}>Adicionar</Button>
              </form>
              {tasks.length === 0 ? <Empty>Sem tarefas. O progresso por tarefas fica “sem tarefas elegíveis”.</Empty> : <div className="card list">{tasks.map((t) => <TaskRow key={t.id} task={t} hideProject />)}</div>}
            </section>
          )}

          <section className="stack">
            <div className="spread"><h2>Notas</h2><span className="row"><Button small onClick={() => void newNote('work')}>Nova nota de trabalho</Button><Button small onClick={() => void newNote('reading')}>Nova nota de leitura</Button></span></div>
            {notes.length === 0 ? <Empty>Nenhuma nota com este contexto.</Empty> : (
              <div className="card list">{notes.map((n) => (
                <div key={n.id} className="list-row"><div className="grow"><button className="link-like" onClick={() => navigate(routeFor(n))}>{n.metadata.title}</button></div><span className="badge">{LABELS.noteType[n.metadata.note_type]}</span></div>
              ))}</div>
            )}
          </section>
        </div>

        <aside className="stack-m card" aria-label="Detalhes">
          <SelectField label="Status" value={m.status} options={ITEM_STATUSES.filter((s) => s !== 'archived' || archived).map((s) => [s, LABELS.itemStatus[s]] as const)} onChange={(v) => v && v !== 'archived' && editor.patch({ status: v })} help={progress === 100 && m.status !== 'completed' ? '100% das tarefas: conclua o projeto manualmente se for o caso.' : undefined} />
          <SelectField label="Prioridade" value={m.priority ?? ''} allowEmpty="Sem prioridade" options={PRIORITIES.map((p) => [p, LABELS.priority[p]] as const)} onChange={(v) => editor.patch({ priority: v || undefined })} />
          <SelectField label="Progresso" value={m.progress_mode} options={PROGRESS_MODES.filter((p) => p !== 'tasks' || m.type === 'project').map((p) => [p, LABELS.progressMode[p]] as const)} onChange={(v) => v && setMode(v)} />
          {m.progress_mode === 'manual' && <TextField label="Progresso manual (%)" type="number" value={String(m.manual_progress ?? 0)} onChange={(v) => editor.patch({ manual_progress: Math.max(0, Math.min(100, Math.round(Number(v) || 0))) })} />}
          <Progress value={progress} mode={m.progress_mode} />
          <TagPicker value={m.tag_ids} onChange={(ids) => editor.patch({ tag_ids: ids })} />
          <div className="field"><span>Grupos (derivados das tags)</span>{groups.length === 0 ? <span className="muted body-s">Sem grupo</span> : <span className="row">{groups.map((g) => <Button key={g.id} small onClick={() => navigate({ screen: 'group', id: g.id })}>{g.metadata.title}</Button>)}</span>}</div>
          <TextField label="Início" type="date" value={m.start_date ?? ''} onChange={(v) => editor.patch({ start_date: v || null })} />
          <TextField label="Prazo-alvo" type="date" value={m.target_date ?? ''} onChange={(v) => editor.patch({ target_date: v || null })} error={targetBeforeStart ? 'Prazo-alvo anterior ao início.' : undefined} />
          <TextField label="URL externa" value={m.external_url ?? ''} onChange={(v) => editor.patch({ external_url: v || null })} />
          {m.external_url && /^https?:/i.test(m.external_url) && <Button small onClick={() => void run(window.atlas.openExternal(m.external_url!))}>Abrir link</Button>}
          {(m.type === 'course' || m.type === 'learning_path' || m.provider) && <TextField label="Instituição / plataforma" value={m.provider ?? ''} onChange={(v) => editor.patch({ provider: v || null })} />}
          <div className="body-s muted stack" style={{ gap: 2 }}>
            <span>Criado: {new Date(m.created_at).toLocaleString('pt-BR')}</span>
            <span>Atualizado: {new Date(m.updated_at).toLocaleString('pt-BR')}</span>
            <span title="UUID imutável">ID: {m.id}</span>
            <span>Arquivo: {record.path}</span>
          </div>
          {!archived ? <Button kind="danger" onClick={() => void archive()}>Arquivar item</Button> : <Button onClick={() => setUnarchiving(true)}>Recuperar item</Button>}
        </aside>
      </div>
      <ConflictDialog editor={editor} />
      {unarchiving && <UnarchiveDialog onClose={() => setUnarchiving(false)} onPick={(s) => void unarchive(s)} />}
    </div>
  )
}

function UnarchiveDialog({ onClose, onPick }: { onClose: () => void; onPick: (s: ItemStatus) => void }) {
  const [status, setStatus] = useState<ItemStatus>('backlog')
  return (
    <Modal title="Recuperar item" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" onClick={() => onPick(status)}>Recuperar</Button></>}>
      <p>O formato não guarda o status anterior. Escolha o status de destino.</p>
      <SelectField label="Status" value={status} options={entries(LABELS.itemStatus).filter(([s]) => s !== 'archived')} onChange={(v) => setStatus((v || 'backlog') as ItemStatus)} />
    </Modal>
  )
}
