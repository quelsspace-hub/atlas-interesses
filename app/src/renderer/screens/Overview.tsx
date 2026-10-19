import { useState } from 'react'
import { isOpenTask, isOverdue, today, type RecordView } from '../../domain/derive.js'
import { LABELS, type Item } from '../../domain/model.js'
import { useAtlas } from '../state.js'
import { Button, Empty, ItemProgress, routeFor } from '../ui.js'
import { captureMetadata } from './Inbox.js'

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return today(d)
}

export function OverviewScreen() {
  const { index, snapshot, navigate, create } = useAtlas()
  const [text, setText] = useState('')
  if (!index || !snapshot) return null
  const day = today()
  const soon = addDays(day, 7)
  const nextActions = index.tasks.filter((t) => isOpenTask(t.metadata) && t.metadata.is_next_action)
  const due = index.tasks.filter((t) => isOpenTask(t.metadata) && t.metadata.due_date && t.metadata.due_date <= soon).sort((a, b) => a.metadata.due_date!.localeCompare(b.metadata.due_date!))
  const targets = index.items.filter((i) => i.metadata.archived_at === null && i.metadata.status !== 'completed' && i.metadata.target_date && i.metadata.target_date <= soon)
  const projects = index.items.filter((i) => i.metadata.type === 'project' && i.metadata.status === 'active')
  const pending = index.captures.filter((c) => c.metadata.status === 'pending')
  const recent = [...index.items, ...index.notes].sort((a, b) => String(b.metadata.updated_at).localeCompare(String(a.metadata.updated_at))).slice(0, 8)
  const problems = snapshot.invalid.length + snapshot.recovery.filter((r) => r.outcome === 'blocked').length

  const capture = async () => {
    if (!text.trim()) return
    const r = await create('capture', captureMetadata('undecided', null), text.trim() + '\n', 'Captura salva na Inbox.')
    if (r) setText('')
  }

  return (
    <div className="page">
      <section className="hub" aria-labelledby="hub-title">
        <h1 id="hub-title" className="display">ATLAS DE INTERESSES</h1>
        <p className="muted">Visão geral · {index.items.length} itens · {index.notes.length} notas · {index.groups.length} grupos</p>
        <form className="row" style={{ justifyContent: 'center', marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); void capture() }}>
          <label className="visually-hidden" htmlFor="quick-capture">Captura rápida</label>
          <input id="quick-capture" className="input" style={{ maxWidth: 520 }} placeholder="Capturar uma ideia, link ou tarefa…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button kind="primary" type="submit" disabled={!text.trim()}>Capturar</Button>
        </form>
      </section>

      {problems > 0 && (
        <div className="banner danger" role="alert">
          {problems} problema(s) no vault (arquivos inválidos ou conversões bloqueadas). Nada foi apagado. <Button small onClick={() => navigate({ screen: 'settings' })}>Ver diagnóstico</Button>
        </div>
      )}

      <div className="grid-2">
        <Panel title="Próximas ações" empty="Marque tarefas como próxima ação para vê-las aqui.">
          {nextActions.map((t) => <Row key={t.id} record={t} meta={t.metadata.project_id ? String(index.byId.get(t.metadata.project_id)?.metadata.title ?? '') : 'Sem projeto'} />)}
        </Panel>
        <Panel title="Prazos (próximos 7 dias e vencidos)" empty="Nenhum prazo próximo.">
          {due.map((t) => <Row key={t.id} record={t} meta={`${isOverdue(t.metadata, day) ? 'Vencida · ' : ''}${t.metadata.due_date}`} danger={isOverdue(t.metadata, day)} />)}
          {targets.map((i) => <Row key={i.id} record={i} meta={`Prazo-alvo ${i.metadata.target_date}`} danger={i.metadata.target_date! < day} />)}
        </Panel>
        <Panel title="Projetos ativos" empty="Nenhum projeto ativo.">
          {projects.map((p) => (
            <div key={p.id} className="list-row">
              <div className="grow"><button className="link-like" onClick={() => navigate(routeFor(p))}>{p.metadata.title}</button></div>
              <div style={{ width: 160 }}><ItemProgress item={p.metadata as Item} /></div>
            </div>
          ))}
        </Panel>
        <Panel title={`Capturas pendentes (${pending.length})`} empty="Inbox vazia.">
          {pending.slice(0, 6).map((c) => <Row key={c.id} record={c} meta={LABELS.captureKind[c.metadata.capture_kind]} label={c.metadata.title || c.body.trim().split('\n')[0] || '(sem texto)'} />)}
        </Panel>
        <Panel title="Recentes" empty="Nada criado ainda.">
          {recent.map((r) => <Row key={r.id} record={r} meta={r.kind === 'item' ? LABELS.itemType[(r.metadata as Item).type] : 'Nota'} />)}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] | React.ReactNode }) {
  const list = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean)
  return (
    <section className="card" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      {list.length === 0 ? <p className="muted body-s">{empty}</p> : <div className="list">{list}</div>}
    </section>
  )
}

function Row({ record, meta, label, danger }: { record: RecordView; meta?: string; label?: string; danger?: boolean }) {
  const { navigate } = useAtlas()
  return (
    <div className="list-row">
      <div className="grow"><button className="link-like" onClick={() => navigate(routeFor(record))}>{label ?? String(record.metadata.title ?? '')}</button></div>
      {meta && <span className={`body-s ${danger ? '' : 'muted'}`} style={danger ? { color: 'var(--danger)' } : undefined}>{meta}</span>}
    </div>
  )
}
