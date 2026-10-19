import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { groupItems, groupNotes, itemGroups, ungroupedItems, type RecordView } from '../../domain/derive.js'
import { ITEM_STATUSES, ITEM_TYPES, LABELS, defaultProgressMode, type Item, type ItemStatus, type ItemType } from '../../domain/model.js'
import { useAtlas } from '../state.js'
import { BackButton, Button, Empty, ItemProgress, MarkdownView, Modal, SelectField, StatusBadge, TagList, TagPicker, TextField, entries, routeFor } from '../ui.js'

export function NewItemDialog({ onClose, presetType, presetTags = [] }: { onClose: () => void; presetType?: ItemType; presetTags?: string[] }) {
  const { create, navigate } = useAtlas()
  const [type, setType] = useState<ItemType>(presetType ?? 'project')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>(presetTags)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    // D-020: novo item em backlog; modo de progresso pelo tipo.
    const r = await create('item', { title: title.trim(), type, status: 'backlog', tag_ids: tags, progress_mode: defaultProgressMode(type), manual_progress: null, summary: '', success_criteria: [] }, '', 'Item criado.')
    setBusy(false)
    if (r) { onClose(); navigate({ screen: 'item', id: r.id }) }
  }
  return (
    <Modal title="Novo item" onClose={onClose} actions={<>
      <Button onClick={onClose}>Cancelar</Button>
      <Button kind="primary" disabled={!title.trim() || busy} onClick={() => void submit()}>Criar</Button>
    </>}>
      <form className="stack-m" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void submit() }}>
        <div className="form-grid">
          <SelectField label="Tipo" value={type} options={entries(LABELS.itemType)} onChange={(v) => setType((v || 'project') as ItemType)} />
          <TextField label="Título" required value={title} onChange={setTitle} autoFocus />
        </div>
        <TagPicker value={tags} onChange={setTags} />
        <p className="muted body-s">Tags e demais detalhes são opcionais e podem ser editados no detalhe.</p>
      </form>
    </Modal>
  )
}

function useItemFilters() {
  const [type, setType] = useState<ItemType | ''>('')
  const [status, setStatus] = useState<ItemStatus | ''>('')
  const [tag, setTag] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const apply = (items: RecordView<'item'>[]) => items.filter((i) => {
    const m = i.metadata
    if (!showArchived && (m.archived_at || m.status === 'archived')) return false
    if (type && m.type !== type) return false
    if (status && m.status !== status) return false
    if (tag && !m.tag_ids.includes(tag)) return false
    return true
  })
  return { type, setType, status, setStatus, tag, setTag, showArchived, setShowArchived, apply }
}

function Filters({ f, hideType }: { f: ReturnType<typeof useItemFilters>; hideType?: boolean }) {
  const { index } = useAtlas()
  return (
    <div className="form-grid" role="search" aria-label="Filtros">
      {!hideType && <SelectField label="Tipo" value={f.type} allowEmpty="Todos" options={ITEM_TYPES.map((t) => [t, LABELS.itemType[t]] as const)} onChange={f.setType} />}
      <SelectField label="Status" value={f.status} allowEmpty="Todos" options={ITEM_STATUSES.map((s) => [s, LABELS.itemStatus[s]] as const)} onChange={f.setStatus} />
      <SelectField label="Tag" value={f.tag} allowEmpty="Todas" options={(index?.tags ?? []).map((t) => [t.id, t.metadata.title] as const)} onChange={f.setTag} />
      <label className="checkbox" style={{ alignSelf: 'end', minHeight: 36 }}><input type="checkbox" checked={f.showArchived} onChange={(e) => f.setShowArchived(e.target.checked)} />Mostrar arquivados</label>
    </div>
  )
}

export function ItemList({ items, empty }: { items: RecordView<'item'>[]; empty: string }) {
  const { navigate, index } = useAtlas()
  if (items.length === 0) return <Empty>{empty}</Empty>
  return (
    <div className="card list">
      {items.map((i) => {
        const groups = index ? itemGroups(index, i.metadata) : []
        return (
          <div key={i.id} className="list-row">
            <div className="grow stack" style={{ gap: 2 }}>
              <button className="link-like" onClick={() => navigate(routeFor(i))}><strong>{i.metadata.title}</strong></button>
              <span className="row body-s muted">
                <span>{LABELS.itemType[i.metadata.type]}</span>
                {groups.length > 0 && <span>· {groups.map((g) => g.metadata.title).join(', ')}</span>}
                {i.metadata.target_date && <span>· prazo {i.metadata.target_date}</span>}
              </span>
              <TagList ids={i.metadata.tag_ids} />
            </div>
            <StatusBadge item={i.metadata} />
            <div style={{ width: 150 }}><ItemProgress item={i.metadata as Item} /></div>
          </div>
        )
      })}
    </div>
  )
}

export function AtlasScreen({ projectsOnly }: { projectsOnly?: boolean }) {
  const { index, navigate } = useAtlas()
  const f = useItemFilters()
  const [creating, setCreating] = useState(false)
  const [ungroupedOnly, setUngroupedOnly] = useState(false)
  const items = useMemo(() => {
    if (!index) return []
    const base = ungroupedOnly ? ungroupedItems(index) : index.items
    return f.apply(projectsOnly ? base.filter((i) => i.metadata.type === 'project') : base)
  }, [index, f, projectsOnly, ungroupedOnly])
  if (!index) return null
  const groups = index.groups.filter((g) => !g.metadata.archived_at)
  const ungrouped = ungroupedItems(index).filter((i) => !i.metadata.archived_at)

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{projectsOnly ? 'Projetos' : 'Atlas'}</h1><p className="muted">{projectsOnly ? 'Itens do tipo projeto, com tarefas e progresso.' : 'Grupos são derivados das tags: um item aparece em todo grupo com o qual compartilha uma tag.'}</p></div>
        <Button kind="primary" onClick={() => setCreating(true)}><Plus size={16} /> Novo {projectsOnly ? 'projeto' : 'item'}</Button>
      </div>
      {!projectsOnly && (
        <section aria-label="Grupos">
          <div className="grid-3">
            {groups.map((g) => {
              const count = groupItems(index, g.metadata).filter((i) => !i.metadata.archived_at).length
              return (
                <button key={g.id} className="card clickable stack" onClick={() => navigate({ screen: 'group', id: g.id })} style={g.metadata.color ? { borderTop: `4px solid ${g.metadata.color}` } : undefined}>
                  <h3>{g.metadata.title}</h3>
                  <span className="muted body-s">{count} {count === 1 ? 'item' : 'itens'} · {g.metadata.tag_ids.length} tag(s)</span>
                  {g.metadata.tag_ids.length === 0 && <span className="body-s muted">Sem tags: o grupo fica vazio até receber tags.</span>}
                </button>
              )
            })}
            <button className="card clickable stack" aria-pressed={ungroupedOnly} onClick={() => setUngroupedOnly((v) => !v)} style={ungroupedOnly ? { borderColor: 'var(--primary)' } : undefined}>
              <h3>Sem grupo</h3>
              <span className="muted body-s">{ungrouped.length} item(ns) sem correspondência em nenhum grupo — continuam acessíveis aqui.</span>
            </button>
          </div>
          {groups.length === 0 && <p className="muted body-s">Nenhum grupo ainda. Crie grupos e tags em Organização.</p>}
        </section>
      )}
      <Filters f={f} hideType={projectsOnly} />
      {ungroupedOnly && <div className="banner">Mostrando apenas itens sem grupo. <Button small onClick={() => setUngroupedOnly(false)}>Mostrar todos</Button></div>}
      <ItemList items={items} empty={index.items.length === 0 ? 'Nenhum item ainda. Crie o primeiro ou processe uma captura da Inbox.' : 'Nenhum resultado para estes filtros — isso não significa perda de dados.'} />
      {creating && <NewItemDialog onClose={() => setCreating(false)} presetType={projectsOnly ? 'project' : undefined} />}
    </div>
  )
}

export function GroupScreen({ id }: { id: string }) {
  const { index, navigate } = useAtlas()
  const f = useItemFilters()
  const [creating, setCreating] = useState(false)
  const group = index?.byId.get(id) as RecordView<'group'> | undefined
  if (!index) return null
  if (!group) return <div className="page"><Empty>Grupo não encontrado. <Button small onClick={() => navigate({ screen: 'atlas' })}>Voltar ao Atlas</Button></Empty></div>
  const items = f.apply(groupItems(index, group.metadata))
  const notes = groupNotes(index, group.metadata).filter((n) => !n.metadata.archived_at)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <BackButton fallback={{ screen: 'atlas' }} />
          <h1>{group.metadata.title}</h1>
          {group.metadata.description && <p className="muted">{group.metadata.description}</p>}
          <div className="row" style={{ marginTop: 8 }}><span className="body-s muted">Tags do grupo:</span><TagList ids={group.metadata.tag_ids} /></div>
        </div>
        <div className="row">
          <Button onClick={() => navigate({ screen: 'organization' })}>Editar grupo</Button>
          <Button kind="primary" onClick={() => setCreating(true)} disabled={group.metadata.tag_ids.length === 0}><Plus size={16} /> Novo item</Button>
        </div>
      </div>
      {group.body.trim() && <div className="card"><MarkdownView source={group.body} fromPath={group.path} /></div>}
      {group.metadata.tag_ids.length === 0 ? <Empty>Este grupo ainda não tem tags. Itens aparecem aqui quando compartilham ao menos uma tag com o grupo. Adicione tags em Organização.</Empty> : (
        <>
          <Filters f={f} />
          <ItemList items={items} empty="Nenhum item com as tags deste grupo." />
        </>
      )}
      <section className="stack">
        <h2>Notas por tema</h2>
        <p className="muted body-s">Notas com tags deste grupo. Não contam como itens.</p>
        {notes.length === 0 ? <Empty>Nenhuma nota com estas tags.</Empty> : (
          <div className="card list">
            {notes.map((n) => (
              <div key={n.id} className="list-row">
                <div className="grow"><button className="link-like" onClick={() => navigate(routeFor(n))}>{n.metadata.title}</button></div>
                <span className="badge">{LABELS.noteType[n.metadata.note_type]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {creating && <NewItemDialog onClose={() => setCreating(false)} presetTags={group.metadata.tag_ids.slice(0, 1)} />}
    </div>
  )
}
