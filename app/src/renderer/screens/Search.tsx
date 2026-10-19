import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecordView } from '../../domain/derive.js'
import { ITEM_STATUSES, ITEM_TYPES, LABELS, NOTE_TYPES, type EntityKind, type ItemStatus, type ItemType, type Note, type NoteType } from '../../domain/model.js'
import { buildSearchIndex, isArchived, sourceCatalog, type SearchFilters } from '../../domain/search.js'
import { useAtlas } from '../state.js'
import { Button, Empty, TagPicker, routeFor } from '../ui.js'

const KIND_LABEL: Record<EntityKind, string> = { item: 'Item', task: 'Tarefa', note: 'Nota', capture: 'Captura', group: 'Grupo', tag: 'Tag' }
const FIELD_LABEL: Record<string, string> = { title: 'título', aliases: 'alias', tags: 'tag', meta: 'metadados', body: 'corpo' }

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="tag-picker">
        {options.map(([v, l]) => {
          const on = value.includes(v)
          return <button key={v} type="button" className="tag-toggle" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}>{l}</button>
        })}
      </div>
    </div>
  )
}

function describe(r: RecordView): string {
  const m = r.metadata as Record<string, unknown>
  switch (r.kind) {
    case 'item': return LABELS.itemType[m.type as ItemType]
    case 'note': return `Nota de ${LABELS.noteType[m.note_type as NoteType].toLowerCase()}`
    case 'task': return `Tarefa · ${LABELS.taskStatus[m.status as keyof typeof LABELS.taskStatus].toLowerCase()}`
    case 'capture': return `Captura · ${LABELS.captureStatus[m.status as keyof typeof LABELS.captureStatus].toLowerCase()}`
    default: return KIND_LABEL[r.kind]
  }
}

export function SearchScreen({ initialQuery }: { initialQuery?: string }) {
  const { index, navigate } = useAtlas()
  const [tab, setTab] = useState<'search' | 'sources'>('search')
  const [query, setQuery] = useState(initialQuery ?? '')
  const [kinds, setKinds] = useState<EntityKind[]>([])
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [statuses, setStatuses] = useState<ItemStatus[]>([])
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [tab])

  // Índice descartável: reconstruído sempre que o índice do vault muda (D-028).
  const search = useMemo(() => (index ? buildSearchIndex(index) : null), [index])
  const filters: SearchFilters = { kinds, itemTypes, itemStatuses: statuses, noteTypes, tagIds, includeArchived }
  const active = query.trim().length > 0 || kinds.length + itemTypes.length + statuses.length + noteTypes.length + tagIds.length > 0
  const hits = useMemo(() => (search && active ? search.search(query, filters) : []), [search, query, active, kinds, itemTypes, statuses, noteTypes, tagIds, includeArchived])
  const sources = useMemo(() => (index ? sourceCatalog(index, includeArchived) : []), [index, includeArchived])
  if (!index || !search) return null
  const clear = () => { setQuery(''); setKinds([]); setItemTypes([]); setStatuses([]); setNoteTypes([]); setTagIds([]) }

  return (
    <div className="page">
      <div className="page-head"><div><h1>Busca</h1><p className="muted">Procura em títulos, aliases, tags, metadados e no corpo de todos os registros. Sem acento e sem caixa; use "frase exata" e -termo para excluir.</p></div></div>
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === 'search'} onClick={() => setTab('search')}>Busca global</button>
        <button role="tab" className="tab" aria-selected={tab === 'sources'} onClick={() => setTab('sources')}>Catálogo de fontes ({sources.length})</button>
      </div>

      {tab === 'search' ? (
        <>
          <form className="row" role="search" onSubmit={(e) => e.preventDefault()}>
            <label className="visually-hidden" htmlFor="global-search">Buscar no vault</label>
            <input id="global-search" ref={input} className="input" style={{ flex: 1, fontSize: 17, minHeight: 44 }} placeholder='Buscar… ex.: jornada "design de serviços" -rascunho' value={query} onChange={(e) => setQuery(e.target.value)} />
            {active && <Button onClick={clear}>Limpar</Button>}
          </form>
          <details className="card">
            <summary className="label-m" style={{ cursor: 'pointer' }}>Filtros{kinds.length + itemTypes.length + statuses.length + noteTypes.length + tagIds.length > 0 ? ` (${kinds.length + itemTypes.length + statuses.length + noteTypes.length + tagIds.length} ativos)` : ''}</summary>
            <div className="stack-m" style={{ marginTop: 12 }}>
              <Chips label="Tipo de registro" options={(['item', 'task', 'note', 'capture', 'group', 'tag'] as const).map((k) => [k, KIND_LABEL[k]] as const)} value={kinds} onChange={setKinds} />
              <Chips label="Tipo de item" options={ITEM_TYPES.map((t) => [t, LABELS.itemType[t]] as const)} value={itemTypes} onChange={setItemTypes} />
              <Chips label="Status do item" options={ITEM_STATUSES.map((s) => [s, LABELS.itemStatus[s]] as const)} value={statuses} onChange={setStatuses} />
              <Chips label="Tipo de nota" options={NOTE_TYPES.map((t) => [t, LABELS.noteType[t]] as const)} value={noteTypes} onChange={setNoteTypes} />
              <TagPicker label="Tags (qualquer uma)" value={tagIds} onChange={setTagIds} />
              <label className="checkbox"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />Incluir arquivados</label>
            </div>
          </details>
          {!active ? <Empty>Digite um termo ou escolha um filtro. {search.size} registros indexados a partir do disco.</Empty> : hits.length === 0 ? <Empty>Nenhum resultado. Isso não significa perda de dados: revise os termos e filtros{includeArchived ? '' : ' ou inclua arquivados'}.</Empty> : (
            <section aria-label="Resultados" className="stack">
              <p className="muted body-s" role="status">{hits.length === 200 ? 'Mostrando os 200 primeiros resultados.' : `${hits.length} resultado(s).`}</p>
              <div className="card list">
                {hits.map((h) => (
                  <div key={h.record.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="grow stack" style={{ gap: 2 }}>
                      <button className="link-like" onClick={() => navigate(routeFor(h.record))}><strong>{String(h.record.metadata.title || h.record.body.trim().split(/\r?\n/)[0] || '(sem título)')}</strong></button>
                      {h.snippet && <span className="body-s">{h.snippet.before}<mark>{h.snippet.match}</mark>{h.snippet.after}</span>}
                      {h.matchedFields.length > 0 && <span className="muted body-s">Encontrado em: {h.matchedFields.map((f) => FIELD_LABEL[f]).join(', ')}</span>}
                    </div>
                    {isArchived(h.record) && <span className="badge archived">Arquivado</span>}
                    <span className="badge">{describe(h.record)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="stack" aria-label="Catálogo de fontes">
          <p className="muted body-s">Derivado dos campos de fonte das notas (título, autoria, ano e URL). Fontes com o mesmo título e autoria, sem diferença de caixa ou acento, ficam juntas. Para catalogar uma fonte, preencha esses campos numa nota de leitura.</p>
          <label className="checkbox"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />Incluir notas arquivadas</label>
          {sources.length === 0 ? <Empty>Nenhuma fonte registrada ainda.</Empty> : (
            <div className="stack">
              {sources.map((s) => (
                <article key={s.key} className="card stack">
                  <div className="spread">
                    <h3>{s.title}</h3>
                    <span className="muted body-s">{s.notes.length} nota(s)</span>
                  </div>
                  <span className="muted body-s">{[s.author, s.year].filter(Boolean).join(' · ') || 'Autoria não informada'}</span>
                  {s.url && /^https?:/i.test(s.url) && <span><Button small onClick={() => void window.atlas.openExternal(s.url!)}>Abrir {s.url}</Button></span>}
                  <div className="row">
                    {s.notes.map((n) => <Button key={n.id} small onClick={() => navigate(routeFor(n))}>{(n.metadata as Note).title}</Button>)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
