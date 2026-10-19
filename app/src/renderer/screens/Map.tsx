import { List, Maximize, Minus, Network, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { itemProgress } from '../../domain/derive.js'
import { buildMapLayout, mapOutline, type MapFilters, type MapNode } from '../../domain/map.js'
import { ITEM_STATUSES, ITEM_TYPES, LABELS, type Item, type ItemStatus, type ItemType } from '../../domain/model.js'
import { isArchived } from '../../domain/search.js'
import { useAtlas } from '../state.js'
import { Button, Empty, ItemProgress, SelectField, routeFor } from '../ui.js'

// V3 (D-029): mapa somente leitura. A vista (zoom, posição, seleção, filtros e modo) fica em memória
// do processo da interface para o retorno ao contexto; nada vai para o vault.
// `moved`: a pessoa já mexeu no zoom/posição; enquanto false, a vista se reajusta ao tamanho real da área.
interface ViewState { x: number; y: number; k: number; selected: string | null; filters: MapFilters; list: boolean; fitted: boolean; moved: boolean }
let saved: ViewState = { x: 0, y: 0, k: 1, selected: null, filters: {}, list: false, fitted: false, moved: false }

const TYPE_MARK: Record<ItemType, string> = { project: 'P', course: 'C', interest: 'I', idea: 'Id', learning_path: 'T', goal: 'M' }
const clampK = (k: number) => Math.min(3, Math.max(0.15, k))

export function MapScreen() {
  const { index, navigate } = useAtlas()
  const [view, setView] = useState<ViewState>(saved)
  useEffect(() => { saved = view }, [view])
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  const layout = useMemo(() => (index ? buildMapLayout(index, view.filters) : null), [index, view.filters])
  const outline = useMemo(() => (index ? mapOutline(index, view.filters) : []), [index, view.filters])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => { if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [view.list])

  const fit = useCallback(() => {
    if (!layout) return
    const { minX, minY, maxX, maxY } = layout.bounds
    const pad = 40
    const k = clampK(Math.min((size.w - pad * 2) / (maxX - minX || 1), (size.h - pad * 2) / (maxY - minY || 1)))
    setView((v) => ({ ...v, k, x: size.w / 2 - ((minX + maxX) / 2) * k, y: size.h / 2 - ((minY + maxY) / 2) * k, fitted: true, moved: false }))
  }, [layout, size])

  // Ajusta na primeira exibição, ao mudar filtros e ao redimensionar, até a pessoa mover a vista.
  useEffect(() => { if (size.w > 0 && (!view.fitted || !view.moved)) fit() }, [view.fitted, fit, size.w, size.h])

  const zoomAt = (factor: number, cx = size.w / 2, cy = size.h / 2) => setView((v) => {
    const k = clampK(v.k * factor)
    return { ...v, k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k, moved: true }
  })
  const setFilters = (patch: Partial<MapFilters>) => setView((v) => ({ ...v, filters: { ...v.filters, ...patch }, fitted: false }))
  const open = (node: MapNode) => { if (node.record) navigate(routeFor(node.record)) }

  if (!index || !layout) return null
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]))
  const selected = view.selected ? nodes.get(view.selected) : undefined
  const related = new Set<string>()
  if (selected) for (const e of layout.edges) { if (e.from === selected.id) related.add(e.to); if (e.to === selected.id) related.add(e.from) }
  const f = view.filters
  const itemCount = layout.nodes.filter((n) => n.kind === 'item').length

  const onKey = (e: React.KeyboardEvent) => {
    const step = 60
    const actions: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + step, moved: true })), ArrowRight: () => setView((v) => ({ ...v, x: v.x - step, moved: true })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + step, moved: true })), ArrowDown: () => setView((v) => ({ ...v, y: v.y - step, moved: true })),
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(0.8), '0': fit
    }
    if (e.target === e.currentTarget && actions[e.key]) { e.preventDefault(); actions[e.key]!() }
  }

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div><h1>Mapa</h1><p className="muted">Visão espacial do Atlas: grupos ao redor do centro e itens perto dos seus grupos. Item em vários grupos aparece uma vez, ligado a cada um. Somente leitura.</p></div>
        <div className="row">
          <Button aria-pressed={!view.list} onClick={() => setView((v) => ({ ...v, list: false, fitted: false }))}><Network size={16} /> Mapa</Button>
          <Button aria-pressed={view.list} onClick={() => setView((v) => ({ ...v, list: true }))}><List size={16} /> Ver como lista</Button>
        </div>
      </div>
      <div className="form-grid" role="group" aria-label="Filtros do mapa">
        <SelectField label="Tipo" value={f.itemTypes?.[0] ?? ''} allowEmpty="Todos" options={ITEM_TYPES.map((t) => [t, LABELS.itemType[t]] as const)} onChange={(v) => setFilters({ itemTypes: v ? [v as ItemType] : [] })} />
        <SelectField label="Status" value={f.itemStatuses?.[0] ?? ''} allowEmpty="Todos" options={ITEM_STATUSES.map((s) => [s, LABELS.itemStatus[s]] as const)} onChange={(v) => setFilters({ itemStatuses: v ? [v as ItemStatus] : [] })} />
        <SelectField label="Tag" value={f.tagIds?.[0] ?? ''} allowEmpty="Todas" options={index.tags.map((t) => [t.id, t.metadata.title] as const)} onChange={(v) => setFilters({ tagIds: v ? [v] : [] })} />
        <div className="stack" style={{ alignSelf: 'end' }}>
          <label className="checkbox"><input type="checkbox" checked={!!f.showNotes} onChange={(e) => setFilters({ showNotes: e.target.checked })} />Mostrar notas de contexto</label>
          <label className="checkbox"><input type="checkbox" checked={!!f.includeArchived} onChange={(e) => setFilters({ includeArchived: e.target.checked })} />Incluir arquivados</label>
        </div>
      </div>

      {view.list ? (
        <section aria-label="Mapa em lista" className="stack">
          {outline.length === 0 && <Empty>Nada para mostrar com estes filtros.</Empty>}
          {outline.map((g) => (
            <section key={g.id} className="card" aria-label={g.label}>
              <h3 className="section-title">{g.label} <span className="muted body-s">{g.items.length} item(ns)</span></h3>
              {g.items.length === 0 ? <p className="muted body-s">{g.id === 'ungrouped' ? '' : 'Grupo sem itens com estes filtros.'}</p> : (
                <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {g.items.map((i) => (
                    <li key={i.id} className="list-row">
                      <div className="grow"><button className="link-like" onClick={() => navigate(routeFor(i))}>{i.metadata.title}</button></div>
                      <span className="badge">{LABELS.itemType[i.metadata.type]}</span>
                      <div style={{ width: 140 }}><ItemProgress item={i.metadata as Item} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </section>
      ) : (
        <div className="map-wrap">
          <div className="map-toolbar" role="toolbar" aria-label="Zoom do mapa">
            <Button icon aria-label="Aproximar" onClick={() => zoomAt(1.25)}><Plus size={16} /></Button>
            <Button icon aria-label="Afastar" onClick={() => zoomAt(0.8)}><Minus size={16} /></Button>
            <Button icon aria-label="Ajustar à tela" onClick={fit}><Maximize size={16} /></Button>
            <span className="body-s muted" aria-live="polite">{Math.round(view.k * 100)}%</span>
          </div>
          <div
            ref={box}
            className="map-canvas"
            tabIndex={0}
            role="application"
            aria-label={`Mapa com ${layout.nodes.length - 1} nós e ${itemCount} itens. Setas movem, + e - aproximam, 0 ajusta. Tab percorre os nós; Enter abre.`}
            onKeyDown={onKey}
            onWheel={(e) => { const r = box.current!.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top) }}
            onPointerDown={(e) => { if ((e.target as Element).closest('.map-node')) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { const d = drag.current; if (!d) return; d.moved = d.moved || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3; setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y, moved: v.moved || d.moved })) }}
            onPointerUp={() => { if (drag.current && !drag.current.moved) setView((v) => ({ ...v, selected: null })); drag.current = null }}
          >
            {itemCount === 0 && <div className="map-empty">Nenhum item com estes filtros. Os dados continuam no vault.</div>}
            <svg width={Math.max(size.w, 1)} height={Math.max(size.h, 1)}>
              <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {layout.edges.map((e, i) => {
                  const a = nodes.get(e.from)!, b = nodes.get(e.to)!
                  const on = !!selected && (e.from === selected.id || e.to === selected.id)
                  return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`map-edge ${e.kind} ${on ? 'on' : ''} ${selected && !on ? 'dim' : ''}`} />
                })}
                {layout.nodes.map((n) => {
                  const dim = !!selected && n.kind !== 'hub' && n.id !== selected.id && !related.has(n.id)
                  const item = n.kind === 'item' ? (n.record!.metadata as Item) : null
                  const label = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label
                  const desc = item ? `${LABELS.itemType[item.type]}, ${LABELS.itemStatus[item.status].toLowerCase()}${n.groupIds?.length ? `, em ${n.groupIds.length} grupo(s)` : ', sem grupo'}` : n.kind === 'group' ? 'grupo' : n.kind === 'note' ? 'nota' : ''
                  return (
                    <g
                      key={n.id}
                      className={`map-node ${n.kind} ${view.selected === n.id ? 'selected' : ''} ${dim ? 'dim' : ''} ${n.record && isArchived(n.record) ? 'archived' : ''}`}
                      transform={`translate(${n.x},${n.y})`}
                      tabIndex={n.kind === 'hub' ? -1 : 0}
                      role="button"
                      aria-label={`${n.label}${desc ? `, ${desc}` : ''}`}
                      onClick={() => setView((v) => ({ ...v, selected: n.id }))}
                      onDoubleClick={() => open(n)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); open(n) } else if (e.key === ' ') { e.preventDefault(); setView((v) => ({ ...v, selected: n.id })) } }}
                      onFocus={() => setView((v) => ({ ...v, selected: n.id }))}
                    >
                      <title>{`${n.label}${desc ? ` — ${desc}` : ''}`}</title>
                      {n.kind === 'hub' ? (
                        <><rect x={-120} y={-34} width={240} height={68} rx={24} className="hub-shape" /><text className="hub-label" textAnchor="middle" dy="0.35em">{n.label}</text></>
                      ) : (
                        <>
                          <circle r={n.r} className="node-shape" style={n.color ? { fill: `color-mix(in srgb, ${n.color} 30%, var(--surface-raised))`, stroke: n.color } : undefined} />
                          {item && <text className="node-mark" textAnchor="middle" dy="0.35em">{TYPE_MARK[item.type]}</text>}
                          {(n.kind !== 'item' && n.kind !== 'note') || view.k >= 0.55 || view.selected === n.id ? <text className={`node-label ${n.kind}`} textAnchor="middle" y={n.r + 16}>{label}</text> : null}
                        </>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
          {selected && selected.kind !== 'hub' && (
            <aside className="card map-panel" aria-label="Nó selecionado">
              <h3>{selected.label}</h3>
              {selected.kind === 'item' && (() => {
                const m = selected.record!.metadata as Item
                const groups = (selected.groupIds ?? []).map((g) => nodes.get(g)?.label).filter(Boolean)
                return (
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="body-s">{LABELS.itemType[m.type]} · {LABELS.itemStatus[m.status]}</span>
                    <span className="body-s muted">{groups.length ? `Grupos: ${groups.join(', ')}` : 'Sem grupo'}</span>
                    {m.progress_mode !== 'none' && <span className="body-s">Progresso: {itemProgress(index, m) ?? '—'}{itemProgress(index, m) === null ? '' : '%'}</span>}
                  </div>
                )
              })()}
              {selected.kind === 'group' && <span className="body-s muted">{related.size - 1} item(ns) ligados</span>}
              {selected.record && <Button kind="primary" small onClick={() => open(selected)}>Abrir</Button>}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
