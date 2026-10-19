import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RecordView } from '../../domain/derive.js'
import { markdownLink } from '../../domain/links.js'
import { LABELS, NOTE_TYPES, type Note, type NoteType } from '../../domain/model.js'
import { nowIso, useAtlas } from '../state.js'
import { BackButton, Button, ConflictDialog, Empty, Modal, SaveBar, SelectField, TagList, TagPicker, TextArea, TextField, entries, routeFor, useRecordEditor } from '../ui.js'
import { BodyEditor } from './Item.js'

function matches(r: RecordView, q: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  const aliases = Array.isArray(r.metadata.aliases) ? (r.metadata.aliases as string[]) : []
  return String(r.metadata.title ?? '').toLowerCase().includes(s) || r.id.startsWith(s) || aliases.some((a) => a.toLowerCase().includes(s))
}

export function NewNoteDialog({ onClose, preset }: { onClose: () => void; preset?: { noteType?: NoteType; contextId?: string } }) {
  const { index, create, navigate } = useAtlas()
  const [title, setTitle] = useState('')
  const [noteType, setNoteType] = useState<NoteType>(preset?.noteType ?? 'reading')
  const [contextId, setContextId] = useState(preset?.contextId ?? '')
  if (!index) return null
  const invalid = !title.trim() || (noteType === 'work' && !contextId)
  const submit = async () => {
    const r = await create('note', { title: title.trim(), note_type: noteType, context_item_id: noteType === 'permanent' ? null : contextId || null, tag_ids: [], aliases: [] }, '', 'Nota criada.')
    if (r) { onClose(); navigate({ screen: 'note', id: r.id }) }
  }
  const items = index.items.filter((i) => !i.metadata.archived_at)
  return (
    <Modal title="Nova nota" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" disabled={invalid} onClick={() => void submit()}>Criar</Button></>}>
      <TextField label="Título" required value={title} onChange={setTitle} autoFocus />
      <div className="form-grid">
        <SelectField label="Tipo" value={noteType} options={entries(LABELS.noteType)} onChange={(v) => setNoteType((v || 'reading') as NoteType)} help={noteType === 'work' ? 'Exige um item de contexto.' : noteType === 'permanent' ? 'Global, sem contexto.' : 'Contexto opcional.'} />
        {noteType !== 'permanent' && <SelectField label={noteType === 'work' ? 'Contexto *' : 'Contexto'} value={contextId} allowEmpty="Sem contexto" options={items.map((i) => [i.id, `${i.metadata.title} (${LABELS.itemType[i.metadata.type]})`] as const)} onChange={setContextId} />}
      </div>
      <p className="muted body-s">O tipo define a pasta do arquivo e não muda depois. Para elaborar uma permanente a partir desta nota, use “Criar nota permanente”.</p>
    </Modal>
  )
}

export function NotesScreen() {
  const { index, navigate } = useAtlas()
  const [type, setType] = useState<NoteType | ''>('')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  if (!index) return null
  const notes = index.notes.filter((n) => (!type || n.metadata.note_type === type) && (showArchived || !n.metadata.archived_at) && matches(n, query))
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Notas</h1><p className="muted">Trabalho (com contexto), leitura (contexto opcional) e permanentes (globais).</p></div>
        <Button kind="primary" onClick={() => setCreating(true)}><Plus size={16} /> Nova nota</Button>
      </div>
      <div className="form-grid">
        <TextField label="Buscar por título, alias ou ID" value={query} onChange={setQuery} />
        <SelectField label="Tipo" value={type} allowEmpty="Todos" options={NOTE_TYPES.map((t) => [t, LABELS.noteType[t]] as const)} onChange={setType} />
        <label className="checkbox" style={{ alignSelf: 'end', minHeight: 36 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Mostrar arquivadas</label>
      </div>
      {notes.length === 0 ? <Empty>{index.notes.length === 0 ? 'Nenhuma nota ainda.' : 'Nenhuma nota para esta busca.'}</Empty> : (
        <div className="card list">
          {notes.map((n) => {
            const ctx = n.metadata.context_item_id ? index.byId.get(n.metadata.context_item_id) : undefined
            return (
              <div key={n.id} className="list-row">
                <div className="grow stack" style={{ gap: 2 }}>
                  <button className="link-like" onClick={() => navigate(routeFor(n))}><strong>{n.metadata.title}</strong></button>
                  <span className="row body-s muted">{ctx && <span>Contexto: {String(ctx.metadata.title)}</span>}{n.metadata.source_title && <span>Fonte: {n.metadata.source_title}</span>}<TagList ids={n.metadata.tag_ids} /></span>
                </div>
                {n.metadata.archived_at && <span className="badge archived">Arquivada</span>}
                <span className="badge">{LABELS.noteType[n.metadata.note_type]}</span>
              </div>
            )
          })}
        </div>
      )}
      {creating && <NewNoteDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

function LinkPicker({ fromPath, onPick, onClose }: { fromPath: string; onPick: (markdown: string) => void; onClose: () => void }) {
  const { index } = useAtlas()
  const [q, setQ] = useState('')
  const candidates = useMemo(() => (index ? [...index.notes, ...index.items].filter((r) => matches(r, q)).slice(0, 40) : []), [index, q])
  return (
    <Modal title="Inserir link" onClose={onClose} actions={<Button onClick={onClose}>Cancelar</Button>}>
      <TextField label="Buscar nota ou item por título, alias ou ID" value={q} onChange={setQ} autoFocus />
      <div className="list">
        {candidates.length === 0 && <p className="muted">Nada encontrado.</p>}
        {candidates.map((r) => (
          <div key={r.id} className="list-row">
            <div className="grow stack" style={{ gap: 0 }}><strong>{String(r.metadata.title)}</strong><span className="muted body-s">{r.kind === 'note' ? LABELS.noteType[(r.metadata as Note).note_type] : 'Item'} · {r.id.slice(0, 8)}{r.metadata.archived_at ? ' · arquivado' : ''}</span></div>
            <Button small onClick={() => onPick(markdownLink(fromPath, r.path, String(r.metadata.title)))}>Inserir</Button>
          </div>
        ))}
      </div>
      <p className="muted body-s">O link é Markdown relativo pelo UUID: renomear o título não o quebra.</p>
    </Modal>
  )
}

function PermanentDialog({ origin, onClose }: { origin: RecordView<'note'>; onClose: () => void }) {
  const { create, navigate } = useAtlas()
  const [title, setTitle] = useState(origin.metadata.title)
  const originLink = markdownLink('notes/permanent/nova.md', origin.path, origin.metadata.title)
  const [body, setBody] = useState(`# ${origin.metadata.title}\n\nEscreva aqui a ideia com suas palavras.\n\nOrigem: ${originLink}\n`)
  const [busy, setBusy] = useState(false)
  // D-008: nova entidade com novo UUID, contexto nulo e link para a origem; a origem não é regravada.
  const submit = async () => {
    setBusy(true)
    const r = await create('note', { title: title.trim(), note_type: 'permanent', context_item_id: null, tag_ids: origin.metadata.tag_ids, aliases: [] }, body, 'Nota permanente criada; a nota de origem não foi alterada.')
    setBusy(false)
    if (r) { onClose(); navigate({ screen: 'note', id: r.id }) }
  }
  return (
    <Modal wide title="Criar nota permanente a partir desta" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" disabled={!title.trim() || busy || !body.includes(originLink)} onClick={() => void submit()}>Salvar nova nota</Button></>}>
      <p className="muted">A nota original continua intacta. A nova nota é global e mantém um link para a origem; o backlink é reconstruído pelo link.</p>
      <TextField label="Título" required value={title} onChange={setTitle} />
      <TextArea label="Conteúdo" value={body} onChange={setBody} rows={12} className="editor" help={body.includes(originLink) ? undefined : 'Mantenha o link de origem no texto.'} />
    </Modal>
  )
}

export function NoteScreen({ id }: { id: string }) {
  const { index, navigate, update, run } = useAtlas()
  const record = index?.byId.get(id) as RecordView<'note'> | undefined
  const editor = useRecordEditor<Note>(record, String(record?.metadata.title ?? 'Nota'))
  const [picking, setPicking] = useState(false)
  const [permanent, setPermanent] = useState(false)
  const [alias, setAlias] = useState('')
  if (!index) return null
  if (!record || !editor.meta) return <div className="page"><Empty>Nota não encontrada. <Button small onClick={() => navigate({ screen: 'notes' })}>Voltar</Button></Empty></div>
  const m = editor.meta
  const links = index.outgoing.get(id) ?? []
  const backlinks = (index.backlinks.get(id) ?? []).map((b) => index.byId.get(b)).filter(Boolean) as RecordView[]
  const ctx = m.context_item_id ? index.byId.get(m.context_item_id) : undefined
  const items = index.items.filter((i) => !i.metadata.archived_at || i.id === m.context_item_id)
  const aliases = m.aliases ?? []
  const archive = async (archived: boolean) => {
    if (editor.changed && !(await editor.save())) return
    const fresh = index.byId.get(id) as RecordView<'note'>
    await update(fresh, { ...fresh.metadata, archived_at: archived ? nowIso() : null }, undefined, archived ? 'Nota arquivada.' : 'Nota recuperada.')
  }
  const attach = async () => {
    const r = await run(window.atlas.addAttachment(record.path))
    if (r) editor.setBody(`${editor.body}${editor.body.endsWith('\n') || !editor.body ? '' : '\n'}${r.markdown}\n`)
  }
  const recordLinks = links.filter((l) => l.kind === 'record' || l.kind === 'missing')

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <BackButton fallback={{ screen: 'notes' }} />
          <span className="row"><span className="badge">{LABELS.noteType[m.note_type]}</span>{m.archived_at && <span className="badge archived">Arquivada</span>}</span>
        </div>
        <div className="row">
          {m.note_type !== 'permanent' && <Button onClick={() => setPermanent(true)}>Criar nota permanente a partir desta</Button>}
          <SaveBar editor={editor} />
        </div>
      </div>
      <div className="detail">
        <div className="stack-m">
          <TextField label="Título" required value={m.title} onChange={(v) => editor.patch({ title: v })} error={!m.title.trim() ? 'O título não pode ficar vazio.' : undefined} help="Renomear mantém o UUID e o caminho; links existentes continuam válidos." />
          <div className="row"><Button small onClick={() => setPicking(true)}>Inserir link para nota ou item</Button></div>
          <BodyEditor body={editor.body} setBody={editor.setBody} fromPath={record.path} onAttach={() => void attach()} />
        </div>
        <aside className="stack-m card" aria-label="Metadados e relações">
          {m.note_type !== 'permanent' && (
            <SelectField label={m.note_type === 'work' ? 'Contexto *' : 'Contexto'} value={m.context_item_id ?? ''} allowEmpty={m.note_type === 'work' ? undefined : 'Sem contexto'} options={items.map((i) => [i.id, `${i.metadata.title}${i.metadata.archived_at ? ' (arquivado)' : ''}`] as const)} onChange={(v) => editor.patch({ context_item_id: v || null })} help={m.context_item_id && !ctx ? 'Item de contexto não encontrado.' : undefined} />
          )}
          {ctx && <Button small onClick={() => navigate(routeFor(ctx))}>Abrir contexto: {String(ctx.metadata.title)}</Button>}
          <TagPicker value={m.tag_ids} onChange={(ids) => editor.patch({ tag_ids: ids })} />
          <div className="field">
            <span>Aliases (títulos anteriores)</span>
            <span className="row">{aliases.map((a, i) => <span key={i} className="badge">{a} <button className="btn ghost small" aria-label={`Remover alias ${a}`} onClick={() => editor.patch({ aliases: aliases.filter((_, j) => j !== i) })}>×</button></span>)}</span>
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (alias.trim()) { editor.patch({ aliases: [...aliases, alias.trim()] }); setAlias('') } }}>
              <input className="input" style={{ flex: 1 }} aria-label="Novo alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
              <Button small type="submit" disabled={!alias.trim()}>Adicionar</Button>
            </form>
          </div>
          {(m.note_type === 'reading' || m.source_title || m.source_author || m.source_url) && (
            <>
              <TextField label="Título da fonte" value={m.source_title ?? ''} onChange={(v) => editor.patch({ source_title: v || null })} />
              <TextField label="Autoria" value={m.source_author ?? ''} onChange={(v) => editor.patch({ source_author: v || null })} />
              <TextField label="URL da fonte" value={m.source_url ?? ''} onChange={(v) => editor.patch({ source_url: v || null })} />
              <TextField label="Ano" type="number" value={m.source_year === null || m.source_year === undefined ? '' : String(m.source_year)} onChange={(v) => editor.patch({ source_year: v ? Math.trunc(Number(v)) : null })} />
            </>
          )}
          <section className="stack">
            <h3>Links de saída</h3>
            {recordLinks.length === 0 ? <span className="muted body-s">Nenhum link para notas ou itens.</span> : recordLinks.map((l, i) => {
              const target = l.targetId ? index.byId.get(l.targetId) : undefined
              return target
                ? <Button key={i} small onClick={() => navigate(routeFor(target))}>{String(target.metadata.title)}{target.metadata.archived_at ? ' (arquivado)' : ''}</Button>
                : <span key={i} className="badge danger" title={l.href}>Link quebrado: {l.text || l.href}</span>
            })}
            <p className="muted body-s">Links salvos no disco; edições não salvas aparecem após salvar.</p>
          </section>
          <section className="stack">
            <h3>Backlinks</h3>
            {backlinks.length === 0 ? <span className="muted body-s">Nenhum registro aponta para esta nota.</span> : backlinks.map((b) => <Button key={b.id} small onClick={() => navigate(routeFor(b))}>{String(b.metadata.title ?? b.id)}</Button>)}
          </section>
          <div className="body-s muted stack" style={{ gap: 2 }}><span>ID: {m.id}</span><span>Arquivo: {record.path}</span></div>
          {m.archived_at ? <Button onClick={() => void archive(false)}>Recuperar nota</Button> : <Button kind="danger" onClick={() => void archive(true)}>Arquivar nota</Button>}
        </aside>
      </div>
      <ConflictDialog editor={editor} />
      {picking && <LinkPicker fromPath={record.path} onClose={() => setPicking(false)} onPick={(md) => { editor.setBody(`${editor.body}${editor.body.endsWith('\n') || !editor.body ? '' : '\n'}${md}\n`); setPicking(false) }} />}
      {permanent && <PermanentDialog origin={index.byId.get(id) as RecordView<'note'>} onClose={() => setPermanent(false)} />}
    </div>
  )
}
