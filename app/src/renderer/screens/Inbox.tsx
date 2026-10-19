import { useMemo, useState } from 'react'
import { nextSortOrder, type RecordView } from '../../domain/derive.js'
import { CAPTURE_KINDS, ITEM_TYPES, LABELS, defaultProgressMode, type CaptureKind, type ConversionType, type InboxCapture, type ItemType, type NoteType } from '../../domain/model.js'
import type { ConversionOutput } from '../../shared/api.js'
import { nowIso, useAtlas } from '../state.js'
import { Button, Empty, MarkdownView, Modal, SelectField, TagPicker, TextArea, TextField, entries, routeFor } from '../ui.js'

const PRIMARY = '$primary'

export function captureMetadata(kind: CaptureKind, title: string | null): Record<string, unknown> {
  return { title, capture_kind: kind, status: 'pending', captured_at: nowIso(), processed_at: null, archived_at: null, converted_to_type: null, converted_to_id: null }
}

export function captureLabel(c: RecordView<'capture'>): string {
  return c.metadata.title || c.body.trim().split(/\r?\n/)[0]?.slice(0, 120) || '(sem texto)'
}

export function InboxScreen({ focusId }: { focusId?: string }) {
  const { index, create, update, navigate } = useAtlas()
  const [tab, setTab] = useState<'pending' | 'processed' | 'archived'>('pending')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<CaptureKind>('undecided')
  const [processing, setProcessing] = useState<RecordView<'capture'> | null>(null)
  if (!index) return null
  const list = index.captures.filter((c) => c.metadata.status === tab)
  const focused = focusId ? index.captures.find((c) => c.id === focusId) : undefined

  const capture = async () => {
    if (!text.trim()) return
    const r = await create('capture', captureMetadata(kind, title.trim() || null), text.trim() + '\n', 'Captura salva.')
    if (r) { setText(''); setTitle(''); setKind('undecided') }
  }
  const setArchived = async (c: RecordView<'capture'>, archived: boolean) => {
    const m = c.metadata
    const next = archived ? { ...m, status: 'archived', archived_at: nowIso() } : { ...m, status: m.converted_to_id ? 'processed' : 'pending', archived_at: null }
    await update(c, next, undefined, archived ? 'Captura arquivada (conteúdo preservado).' : 'Captura recuperada.')
  }

  return (
    <div className="page">
      <div className="page-head"><div><h1>Inbox</h1><p className="muted">Capture primeiro, organize depois. A captura nunca é apagada.</p></div></div>
      <form className="card stack-m" onSubmit={(e) => { e.preventDefault(); void capture() }}>
        <TextArea label="Conteúdo *" value={text} onChange={setText} rows={3} help="Texto original preservado no corpo Markdown da captura." />
        <div className="form-grid">
          <TextField label="Título (opcional)" value={title} onChange={setTitle} />
          <SelectField label="Tipo de captura" value={kind} options={entries(LABELS.captureKind)} onChange={(v) => setKind((v || 'undecided') as CaptureKind)} help="“Indefinido” mantém a classificação em aberto." />
        </div>
        <div className="row end"><Button kind="primary" type="submit" disabled={!text.trim()}>Capturar</Button></div>
      </form>

      <div className="tabs" role="tablist">
        {(['pending', 'processed', 'archived'] as const).map((s) => (
          <button key={s} role="tab" className="tab" aria-selected={tab === s} onClick={() => setTab(s)}>{LABELS.captureStatus[s]} ({index.captures.filter((c) => c.metadata.status === s).length})</button>
        ))}
      </div>
      {list.length === 0 ? <Empty>{tab === 'pending' ? 'Nenhuma captura pendente.' : 'Nada aqui.'}</Empty> : (
        <div className="stack">
          {list.map((c) => {
            const result = c.metadata.converted_to_id ? index.byId.get(c.metadata.converted_to_id) : undefined
            return (
              <article key={c.id} className="card stack" style={focused?.id === c.id ? { borderColor: 'var(--primary)' } : undefined}>
                <div className="spread">
                  <strong>{captureLabel(c)}</strong>
                  <span className="row"><span className="badge">{LABELS.captureKind[c.metadata.capture_kind]}</span><span className="muted body-s">{new Date(c.metadata.captured_at).toLocaleString('pt-BR')}</span></span>
                </div>
                <MarkdownView source={c.body} fromPath={c.path} />
                <div className="row end">
                  {result && <Button small onClick={() => navigate(routeFor(result))}>Abrir resultado: {String(result.metadata.title)}</Button>}
                  {c.metadata.converted_to_id && !result && <span className="badge danger">Resultado não encontrado</span>}
                  {c.metadata.status === 'pending' && <Button kind="primary" small onClick={() => setProcessing(c)}>Processar</Button>}
                  {c.metadata.status !== 'archived' ? <Button small onClick={() => void setArchived(c, true)}>Arquivar</Button> : <Button small onClick={() => void setArchived(c, false)}>Recuperar</Button>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {processing && <ProcessDialog capture={processing} onClose={() => setProcessing(null)} />}
    </div>
  )
}

function suggestedType(kind: CaptureKind): ConversionType {
  if (kind === 'task' || kind === 'note' || kind === 'project' || kind === 'course') return kind
  if (kind === 'link') return 'note'
  return 'idea'
}

function ProcessDialog({ capture, onClose }: { capture: RecordView<'capture'>; onClose: () => void }) {
  const { index, convert, navigate } = useAtlas()
  const [type, setType] = useState<ConversionType>(suggestedType((capture.metadata as InboxCapture).capture_kind))
  const [title, setTitle] = useState(captureLabel(capture))
  const [body, setBody] = useState(capture.body.replace(/^\r?\n/, ''))
  const [tags, setTags] = useState<string[]>([])
  const [tasks, setTasks] = useState('')
  const [projectId, setProjectId] = useState('')
  const [due, setDue] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('reading')
  const [contextId, setContextId] = useState('')
  const [busy, setBusy] = useState(false)
  const projects = useMemo(() => (index?.items ?? []).filter((i) => i.metadata.type === 'project' && !i.metadata.archived_at), [index])
  const items = useMemo(() => (index?.items ?? []).filter((i) => !i.metadata.archived_at), [index])
  if (!index) return null
  const isItem = (ITEM_TYPES as readonly string[]).includes(type)
  const invalid = !title.trim() || (type === 'note' && noteType === 'work' && !contextId)

  const submit = async () => {
    setBusy(true)
    const outputs: ConversionOutput[] = []
    if (isItem) {
      const itemType = type as ItemType
      outputs.push({ kind: 'item', input: { title: title.trim(), type: itemType, status: 'backlog', tag_ids: tags, progress_mode: defaultProgressMode(itemType), manual_progress: null, summary: '', success_criteria: [] }, body })
      if (itemType === 'project') {
        let order = 0
        for (const line of tasks.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
          outputs.push({ kind: 'task', input: { title: line, status: 'todo', project_id: PRIMARY, is_next_action: order === 0, sort_order: nextSortOrder(index.tasks) + order, completed_at: null }, body: '' })
          order++
        }
      }
    } else if (type === 'task') {
      outputs.push({ kind: 'task', input: { title: title.trim(), status: 'todo', project_id: projectId || null, is_next_action: false, due_date: due || null, sort_order: nextSortOrder(index.tasks), completed_at: null }, body })
    } else {
      outputs.push({ kind: 'note', input: { title: title.trim(), note_type: noteType, context_item_id: noteType === 'permanent' ? null : contextId || null, tag_ids: tags, aliases: [] }, body })
    }
    const primaryId = await convert(capture, outputs)
    setBusy(false)
    if (primaryId) {
      onClose()
      navigate(type === 'task' ? { screen: 'tasks', id: primaryId } : type === 'note' ? { screen: 'note', id: primaryId } : { screen: 'item', id: primaryId })
    }
  }

  const typeOptions: Array<[ConversionType, string]> = [...ITEM_TYPES.map((t) => [t, LABELS.itemType[t]] as [ConversionType, string]), ['task', 'Tarefa'], ['note', 'Nota']]
  return (
    <Modal wide title="Processar captura" onClose={onClose} actions={<>
      <Button onClick={onClose}>Cancelar</Button>
      <Button kind="primary" disabled={invalid || busy} onClick={() => void submit()}>{busy ? 'Gravando…' : 'Confirmar conversão'}</Button>
    </>}>
      <p className="muted">A captura é preservada e passa a registrar o resultado. A conversão só aparece como concluída depois de gravada e verificada.</p>
      <div className="form-grid">
        <SelectField label="Resultado principal" value={type} options={typeOptions} onChange={(v) => setType((v || 'idea') as ConversionType)} />
        <TextField label="Título" required value={title} onChange={setTitle} error={!title.trim() ? 'Informe um título.' : undefined} />
      </div>
      {isItem && <TagPicker value={tags} onChange={setTags} />}
      {type === 'project' && <TextArea label="Tarefas derivadas (uma por linha, opcional)" value={tasks} onChange={setTasks} rows={4} help="A primeira tarefa vira próxima ação." />}
      {type === 'task' && (
        <div className="form-grid">
          <SelectField label="Projeto" value={projectId} allowEmpty="Sem projeto (avulsa)" options={projects.map((p) => [p.id, p.metadata.title] as const)} onChange={setProjectId} />
          <TextField label="Prazo" type="date" value={due} onChange={setDue} />
        </div>
      )}
      {type === 'note' && (
        <>
          <div className="form-grid">
            <SelectField label="Tipo de nota" value={noteType} options={entries(LABELS.noteType)} onChange={(v) => setNoteType((v || 'reading') as NoteType)} help={noteType === 'work' ? 'Nota de trabalho exige um item de contexto.' : noteType === 'permanent' ? 'Nota permanente é global (sem contexto).' : 'Contexto opcional.'} />
            {noteType !== 'permanent' && <SelectField label={noteType === 'work' ? 'Contexto *' : 'Contexto'} value={contextId} allowEmpty="Sem contexto" options={items.map((i) => [i.id, `${i.metadata.title} (${LABELS.itemType[i.metadata.type]})`] as const)} onChange={setContextId} />}
          </div>
          <TagPicker value={tags} onChange={setTags} />
        </>
      )}
      <TextArea label="Conteúdo do resultado" value={body} onChange={setBody} rows={6} help="Copiado da captura; edite à vontade. O texto original continua na captura." />
    </Modal>
  )
}

export { CAPTURE_KINDS }
