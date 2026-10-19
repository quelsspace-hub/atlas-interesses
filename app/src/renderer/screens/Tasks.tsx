import { useState } from 'react'
import { isOpenTask, isOverdue, nextSortOrder, today, type RecordView } from '../../domain/derive.js'
import { LABELS, PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from '../../domain/model.js'
import { nowIso, useAtlas } from '../state.js'
import { Button, ConflictDialog, Empty, Modal, SaveBar, SelectField, TextArea, TextField, useRecordEditor } from '../ui.js'

// D-022: concluir/cancelar limpa a próxima ação; reabrir limpa completed_at e não restaura a marca.
export function statusPatch(task: Task, status: TaskStatus): Partial<Task> {
  if (status === 'done') return { status, completed_at: task.completed_at ?? nowIso(), is_next_action: false }
  if (status === 'canceled') return { status, completed_at: null, is_next_action: false }
  return { status, completed_at: null }
}

export function TaskRow({ task, hideProject }: { task: RecordView<'task'>; hideProject?: boolean }) {
  const { index, update, navigate } = useAtlas()
  const [editing, setEditing] = useState(false)
  const m = task.metadata
  const project = m.project_id ? index?.byId.get(m.project_id) : undefined
  const done = m.status === 'done'
  const set = (p: Partial<Task>, text?: string) => void update(task, { ...m, ...p }, undefined, text)
  return (
    <div className="list-row">
      <input type="checkbox" aria-label={done ? `Reabrir ${m.title}` : `Concluir ${m.title}`} checked={done} disabled={m.status === 'canceled'} onChange={() => set(statusPatch(m, done ? 'todo' : 'done'))} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
      <div className="grow stack" style={{ gap: 2 }}>
        <button className="link-like" onClick={() => setEditing(true)} style={done || m.status === 'canceled' ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{m.title}</button>
        <span className="row body-s muted">
          {m.status === 'in_progress' && <span className="badge">Em andamento</span>}
          {m.status === 'canceled' && <span className="badge archived">Cancelada</span>}
          {m.is_next_action && <span className="badge next">Próxima ação</span>}
          {m.archived_at && <span className="badge archived">Arquivada</span>}
          {m.priority && <span>Prioridade {LABELS.priority[m.priority].toLowerCase()}</span>}
          {m.due_date && <span style={isOverdue(m) ? { color: 'var(--danger)' } : undefined}>{isOverdue(m) ? 'Vencida · ' : 'Prazo '}{m.due_date}</span>}
          {!hideProject && (project ? <button className="btn ghost small" onClick={() => navigate({ screen: 'item', id: project.id })}>{String(project.metadata.title)}</button> : <span>Sem projeto</span>)}
        </span>
      </div>
      {isOpenTask(m) && <Button small kind="ghost" aria-pressed={m.is_next_action} onClick={() => set({ is_next_action: !m.is_next_action })}>{m.is_next_action ? 'Desmarcar próxima' : 'Próxima ação'}</Button>}
      {editing && <TaskDialog task={task} onClose={() => setEditing(false)} />}
    </div>
  )
}

function TaskDialog({ task, onClose }: { task: RecordView<'task'>; onClose: () => void }) {
  const { index, update } = useAtlas()
  const editor = useRecordEditor<Task>(task, String(task.metadata.title))
  if (!editor.meta || !index) return null
  const m = editor.meta
  const projects = index.items.filter((i) => i.metadata.type === 'project' && (!i.metadata.archived_at || i.id === m.project_id))
  const close = async (save: boolean) => { if (save && !(await editor.save())) return; editor.discard(); onClose() }
  const archive = async (archived: boolean) => {
    if (editor.changed && !(await editor.save())) return
    const fresh = index.byId.get(task.id) as RecordView<'task'>
    const r = await update(fresh, { ...fresh.metadata, archived_at: archived ? nowIso() : null }, undefined, archived ? 'Tarefa arquivada.' : 'Tarefa recuperada.')
    if (!('code' in r)) onClose()
  }
  return (
    <Modal wide title="Tarefa" onClose={() => void close(false)} actions={<>
      {m.archived_at ? <Button onClick={() => void archive(false)}>Recuperar</Button> : <Button kind="danger" onClick={() => void archive(true)}>Arquivar</Button>}
      <Button onClick={() => void close(false)}>Fechar sem salvar</Button>
      <SaveBar editor={editor} />
    </>}>
      <TextField label="Título" required value={m.title} onChange={(v) => editor.patch({ title: v })} error={!m.title.trim() ? 'Informe um título.' : undefined} />
      <div className="form-grid">
        <SelectField label="Status" value={m.status} options={TASK_STATUSES.map((s) => [s, LABELS.taskStatus[s]] as const)} onChange={(v) => v && editor.patch(statusPatch(m, v))} />
        <SelectField label="Projeto" value={m.project_id ?? ''} allowEmpty="Sem projeto (avulsa)" options={projects.map((p) => [p.id, p.metadata.title] as const)} onChange={(v) => editor.patch({ project_id: v || null })} help="Só itens do tipo projeto." />
        <TextField label="Prazo" type="date" value={m.due_date ?? ''} onChange={(v) => editor.patch({ due_date: v || null })} />
        <SelectField label="Prioridade" value={m.priority ?? ''} allowEmpty="Sem prioridade" options={PRIORITIES.map((p) => [p, LABELS.priority[p]] as const)} onChange={(v) => editor.patch({ priority: v || undefined })} />
      </div>
      <label className="checkbox"><input type="checkbox" checked={m.is_next_action} disabled={!isOpenTask(m)} onChange={(e) => editor.patch({ is_next_action: e.target.checked })} />Próxima ação</label>
      <TextArea label="Detalhes (corpo Markdown)" value={editor.body} onChange={editor.setBody} rows={6} />
      {m.completed_at && <p className="muted body-s">Concluída em {new Date(m.completed_at).toLocaleString('pt-BR')}</p>}
      <ConflictDialog editor={editor} />
    </Modal>
  )
}

type View = 'open' | 'next' | 'overdue' | 'project' | 'history'

export function TasksScreen({ focusId }: { focusId?: string }) {
  const { index, create } = useAtlas()
  const [view, setView] = useState<View>('open')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [due, setDue] = useState('')
  if (!index) return null
  const day = today()
  const all = index.tasks
  const open = all.filter((t) => isOpenTask(t.metadata))
  const lists: Record<View, RecordView<'task'>[]> = {
    open,
    next: open.filter((t) => t.metadata.is_next_action),
    overdue: open.filter((t) => isOverdue(t.metadata, day)),
    project: open,
    history: all.filter((t) => !isOpenTask(t.metadata)).sort((a, b) => String(b.metadata.completed_at ?? b.metadata.updated_at).localeCompare(String(a.metadata.completed_at ?? a.metadata.updated_at)))
  }
  const labels: Record<View, string> = { open: 'Abertas', next: 'Próximas ações', overdue: 'Vencidas', project: 'Por projeto', history: 'Concluídas e arquivadas' }
  const projects = index.items.filter((i) => i.metadata.type === 'project' && !i.metadata.archived_at)
  const focused = focusId ? all.find((t) => t.id === focusId) : undefined

  const add = async () => {
    if (!title.trim()) return
    const r = await create('task', { title: title.trim(), status: 'todo', project_id: projectId || null, is_next_action: false, due_date: due || null, sort_order: nextSortOrder(all), completed_at: null }, '', 'Tarefa criada.')
    if (r) { setTitle(''); setDue('') }
  }

  const list = lists[view]
  return (
    <div className="page">
      <div className="page-head"><div><h1>Tarefas</h1><p className="muted">Avulsas ou ligadas a um projeto. Concluídas ficam no histórico.</p></div></div>
      <form className="card form-grid" onSubmit={(e) => { e.preventDefault(); void add() }}>
        <TextField label="Nova tarefa" value={title} onChange={setTitle} />
        <SelectField label="Projeto" value={projectId} allowEmpty="Sem projeto (avulsa)" options={projects.map((p) => [p.id, p.metadata.title] as const)} onChange={setProjectId} />
        <TextField label="Prazo" type="date" value={due} onChange={setDue} />
        <div style={{ alignSelf: 'end' }}><Button kind="primary" type="submit" disabled={!title.trim()}>Adicionar</Button></div>
      </form>
      {focused && <div className="card"><h3 className="section-title">Tarefa selecionada</h3><div className="list"><TaskRow task={focused} /></div></div>}
      <div className="tabs" role="tablist">
        {(Object.keys(labels) as View[]).map((v) => <button key={v} role="tab" className="tab" aria-selected={view === v} onClick={() => setView(v)}>{labels[v]} ({v === 'project' ? open.length : lists[v].length})</button>)}
      </div>
      {view === 'project' ? (
        <div className="stack-m">
          {[...projects.map((p) => ({ key: p.id, title: p.metadata.title, tasks: open.filter((t) => t.metadata.project_id === p.id) })), { key: 'none', title: 'Sem projeto', tasks: open.filter((t) => !t.metadata.project_id) }]
            .filter((g) => g.tasks.length > 0)
            .map((g) => <section key={g.key} className="card"><h3 className="section-title">{g.title}</h3><div className="list">{g.tasks.map((t) => <TaskRow key={t.id} task={t} hideProject />)}</div></section>)}
          {open.length === 0 && <Empty>Nenhuma tarefa aberta.</Empty>}
        </div>
      ) : list.length === 0 ? <Empty>{view === 'history' ? 'Nenhuma tarefa concluída, cancelada ou arquivada.' : 'Nenhuma tarefa nesta lista.'}</Empty> : <div className="card list">{list.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
    </div>
  )
}
