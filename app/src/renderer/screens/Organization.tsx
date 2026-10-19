import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { groupItems, nextSortOrder, sharesTag, type RecordView } from '../../domain/derive.js'
import type { Group, Tag } from '../../domain/model.js'
import { nowIso, useAtlas } from '../state.js'
import { Button, ConflictDialog, Empty, Modal, SaveBar, TagBadge, TagPicker, TextArea, TextField, useRecordEditor } from '../ui.js'

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
const colorOk = (c: string) => c === '' || /^#[0-9A-Fa-f]{6}$/.test(c)

function ColorField({ value, onChange }: { value: string | null | undefined; onChange: (v: string | null) => void }) {
  const v = value ?? ''
  return (
    <div className="row" style={{ alignItems: 'end' }}>
      <div style={{ flex: 1 }}><TextField label="Cor (#RRGGBB, opcional)" value={v} onChange={(x) => onChange(x || null)} error={colorOk(v) ? undefined : 'Use o formato #RRGGBB.'} /></div>
      <input type="color" aria-label="Escolher cor" value={colorOk(v) && v ? v : '#241F6F'} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ height: 36, width: 44, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent' }} />
    </div>
  )
}

export function OrganizationScreen() {
  const { index, create, update } = useAtlas()
  const [tab, setTab] = useState<'groups' | 'tags'>('groups')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  if (!index) return null

  const tagUsage = (tagId: string) => ({
    items: index.items.filter((i) => i.metadata.tag_ids.includes(tagId)).length,
    notes: index.notes.filter((n) => n.metadata.tag_ids.includes(tagId)).length,
    groups: index.groups.filter((g) => g.metadata.tag_ids.includes(tagId)).length
  })
  const duplicates = (title: string, kind: 'tag' | 'group', self?: string) => (kind === 'tag' ? index.tags : index.groups).filter((r) => r.id !== self && norm(String(r.metadata.title)) === norm(title))

  const addTag = async () => {
    if (!newTag.trim()) return
    if (await create('tag', { title: newTag.trim(), description: '', color: null, aliases: [] }, '', duplicates(newTag, 'tag').length ? 'Tag criada. Atenção: já existe uma tag com título equivalente.' : 'Tag criada.')) setNewTag('')
  }
  const addGroup = async () => {
    if (!newGroup.trim()) return
    if (await create('group', { title: newGroup.trim(), description: '', color: null, icon: null, tag_ids: [], sort_order: nextSortOrder(index.groups) }, '', duplicates(newGroup, 'group').length ? 'Grupo criado. Atenção: já existe um grupo com título equivalente.' : 'Grupo criado.')) setNewGroup('')
  }
  const groups = index.groups.filter((g) => showArchived || !g.metadata.archived_at)
  const tags = index.tags.filter((t) => showArchived || !t.metadata.archived_at)
  const move = async (g: RecordView<'group'>, dir: -1 | 1) => {
    const visible = index.groups
    const i = visible.findIndex((x) => x.id === g.id)
    const other = visible[i + dir]
    if (!other) return
    const a = g.metadata.sort_order, b = other.metadata.sort_order
    const first = await update(g, { ...g.metadata, sort_order: b === a ? a + dir : b })
    if ('code' in first) return
    await update(other, { ...other.metadata, sort_order: a })
  }

  return (
    <div className="page">
      <div className="page-head"><div><h1>Organização</h1><p className="muted">Tags classificam itens e notas; grupos reúnem itens por OR de tags. Nada é apagado: arquivar preserva referências.</p></div></div>
      <div className="spread">
        <div className="tabs" role="tablist">
          <button role="tab" className="tab" aria-selected={tab === 'groups'} onClick={() => setTab('groups')}>Grupos ({index.groups.length})</button>
          <button role="tab" className="tab" aria-selected={tab === 'tags'} onClick={() => setTab('tags')}>Tags ({index.tags.length})</button>
        </div>
        <label className="checkbox"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Mostrar arquivados</label>
      </div>

      {tab === 'tags' ? (
        <>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void addTag() }}>
            <label className="visually-hidden" htmlFor="new-tag">Nova tag</label>
            <input id="new-tag" className="input" style={{ maxWidth: 360 }} placeholder="Nova tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
            <Button kind="primary" type="submit" disabled={!newTag.trim()}><Plus size={16} /> Criar tag</Button>
            {newTag.trim() && duplicates(newTag, 'tag').length > 0 && <span className="body-s" style={{ color: 'var(--warning-text)' }}>Já existe uma tag com título equivalente (não serão fundidas).</span>}
          </form>
          {tags.length === 0 ? <Empty>Nenhuma tag.</Empty> : (
            <div className="card list">
              {tags.map((t) => {
                const u = tagUsage(t.id)
                return (
                  <div key={t.id} className="list-row">
                    <div className="grow stack" style={{ gap: 2 }}>
                      <span className="row"><TagBadge tag={t.metadata} />{duplicates(t.metadata.title, 'tag', t.id).length > 0 && <span className="badge danger">Título duplicado</span>}</span>
                      <span className="muted body-s">{u.items} item(ns) · {u.notes} nota(s) · {u.groups} grupo(s){t.metadata.description ? ` · ${t.metadata.description}` : ''}</span>
                    </div>
                    <Button small onClick={() => setEditingTag(t.id)}>Editar</Button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void addGroup() }}>
            <label className="visually-hidden" htmlFor="new-group">Novo grupo</label>
            <input id="new-group" className="input" style={{ maxWidth: 360 }} placeholder="Novo grupo…" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            <Button kind="primary" type="submit" disabled={!newGroup.trim()}><Plus size={16} /> Criar grupo</Button>
          </form>
          {groups.length === 0 ? <Empty>Nenhum grupo. Crie um grupo e associe tags a ele.</Empty> : (
            <div className="card list">
              {groups.map((g, i) => (
                <div key={g.id} className="list-row">
                  <div className="grow stack" style={{ gap: 2 }}>
                    <span className="row"><strong>{g.metadata.title}</strong>{g.metadata.archived_at && <span className="badge archived">Arquivado</span>}{duplicates(g.metadata.title, 'group', g.id).length > 0 && <span className="badge danger">Título duplicado</span>}</span>
                    <span className="row">{g.metadata.tag_ids.length === 0 ? <span className="muted body-s">Sem tags (grupo vazio)</span> : g.metadata.tag_ids.map((id) => <TagBadge key={id} tag={index.byId.get(id)?.metadata as Tag | undefined} />)}</span>
                    <span className="muted body-s">{groupItems(index, g.metadata).length} item(ns)</span>
                  </div>
                  <Button small icon aria-label={`Mover ${g.metadata.title} para cima`} disabled={i === 0} onClick={() => void move(g, -1)}><ArrowUp size={16} /></Button>
                  <Button small icon aria-label={`Mover ${g.metadata.title} para baixo`} disabled={i === groups.length - 1} onClick={() => void move(g, 1)}><ArrowDown size={16} /></Button>
                  <Button small onClick={() => setEditingGroup(g.id)}>Editar</Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {editingTag && <TagDialog tag={index.byId.get(editingTag) as RecordView<'tag'>} onClose={() => setEditingTag(null)} />}
      {editingGroup && <GroupDialog group={index.byId.get(editingGroup) as RecordView<'group'>} onClose={() => setEditingGroup(null)} />}
    </div>
  )
}

function TagDialog({ tag, onClose }: { tag: RecordView<'tag'>; onClose: () => void }) {
  const editor = useRecordEditor<Tag>(tag, String(tag.metadata.title))
  const { update, index } = useAtlas()
  const [alias, setAlias] = useState('')
  if (!editor.meta || !index) return null
  const m = editor.meta
  const aliases = m.aliases ?? []
  const close = () => { editor.discard(); onClose() }
  const archive = async (archived: boolean) => {
    if (editor.changed && !(await editor.save())) return
    const fresh = index.byId.get(tag.id) as RecordView<'tag'>
    const r = await update(fresh, { ...fresh.metadata, archived_at: archived ? nowIso() : null }, undefined, archived ? 'Tag arquivada; itens, notas e grupos continuam com a referência.' : 'Tag recuperada.')
    if (!('code' in r)) onClose()
  }
  return (
    <Modal title="Editar tag" onClose={close} actions={<>
      {m.archived_at ? <Button onClick={() => void archive(false)}>Recuperar</Button> : <Button kind="danger" onClick={() => void archive(true)}>Arquivar</Button>}
      <Button onClick={close}>Fechar</Button>
      <SaveBar editor={editor} />
    </>}>
      <TextField label="Título" required value={m.title} onChange={(v) => editor.patch({ title: v })} help="Renomear não altera os arquivos dos itens e notas: eles referenciam o UUID." />
      <TextArea label="Descrição" value={m.description ?? ''} onChange={(v) => editor.patch({ description: v })} rows={2} />
      <ColorField value={m.color} onChange={(c) => editor.patch({ color: c })} />
      <div className="field">
        <span>Sinônimos</span>
        <span className="row">{aliases.map((a, i) => <span key={i} className="badge">{a} <button className="btn ghost small" aria-label={`Remover ${a}`} onClick={() => editor.patch({ aliases: aliases.filter((_, j) => j !== i) })}>×</button></span>)}</span>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (alias.trim()) { editor.patch({ aliases: [...aliases, alias.trim()] }); setAlias('') } }}>
          <input className="input" style={{ flex: 1 }} aria-label="Novo sinônimo" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <Button small type="submit" disabled={!alias.trim()}>Adicionar</Button>
        </form>
      </div>
      <ConflictDialog editor={editor} />
    </Modal>
  )
}

function GroupDialog({ group, onClose }: { group: RecordView<'group'>; onClose: () => void }) {
  const editor = useRecordEditor<Group>(group, String(group.metadata.title))
  const { update, index } = useAtlas()
  if (!editor.meta || !index) return null
  const m = editor.meta
  // Prévia de impacto: itens que deixam de aparecer no grupo com as tags novas (F-01).
  const leaving = groupItems(index, group.metadata).filter((i) => !sharesTag(m.tag_ids, i.metadata.tag_ids))
  const close = () => { editor.discard(); onClose() }
  const archive = async (archived: boolean) => {
    if (editor.changed && !(await editor.save())) return
    const fresh = index.byId.get(group.id) as RecordView<'group'>
    const r = await update(fresh, { ...fresh.metadata, archived_at: archived ? nowIso() : null }, undefined, archived ? 'Grupo arquivado.' : 'Grupo recuperado.')
    if (!('code' in r)) onClose()
  }
  return (
    <Modal wide title="Editar grupo" onClose={close} actions={<>
      {m.archived_at ? <Button onClick={() => void archive(false)}>Recuperar</Button> : <Button kind="danger" onClick={() => void archive(true)}>Arquivar</Button>}
      <Button onClick={close}>Fechar</Button>
      <SaveBar editor={editor} />
    </>}>
      <TextField label="Título" required value={m.title} onChange={(v) => editor.patch({ title: v })} />
      <TextArea label="Descrição curta" value={m.description ?? ''} onChange={(v) => editor.patch({ description: v })} rows={2} />
      <ColorField value={m.color} onChange={(c) => editor.patch({ color: c })} />
      <TagPicker label="Tags do grupo (um item aparece se tiver qualquer uma)" value={m.tag_ids} onChange={(ids) => editor.patch({ tag_ids: ids })} />
      {leaving.length > 0 && (
        <div className="banner" role="alert">
          Ao salvar, {leaving.length} item(ns) deixam de aparecer neste grupo (continuam no vault e nos outros grupos): {leaving.slice(0, 8).map((i) => i.metadata.title).join(', ')}{leaving.length > 8 ? '…' : ''}.
        </div>
      )}
      <TextArea label="Texto longo (corpo Markdown)" value={editor.body} onChange={editor.setBody} rows={5} />
      <ConflictDialog editor={editor} />
    </Modal>
  )
}
