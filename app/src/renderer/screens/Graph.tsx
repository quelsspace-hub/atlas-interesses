import { Crosshair, List, Maximize, Minus, Network, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_RELATIONS, RELATION_LABEL, buildGraph, type GraphEdge, type GraphNode, type RelationKind } from '../../domain/graph.js'
import { fold, isArchived } from '../../domain/search.js'
import { useAtlas } from '../state.js'
import { Button, Empty, routeFor } from '../ui.js'

// V4 (D-030): grafo somente leitura. Links persistidos (linha contínua com seta) e relações
// derivadas (tracejadas) são distinguidos por traço, legenda e texto, não só por cor.
interface View { x: number; y: number; k: number; moved: boolean; fitted: boolean; selected: string | null; edge: number | null; relations: RelationKind[]; depth: 1 | 2 | 3; archived: boolean; list: boolean }
let saved: View = { x: 0, y: 0, k: 1, moved: false, fitted: false, selected: null, edge: null, relations: DEFAULT_RELATIONS, depth: 1, archived: false, list: false }
let savedFocus: string | null = null

const KIND_LABEL: Record<string, string> = { item: 'Item', task: 'Tarefa', note: 'Nota', capture: 'Captura', group: 'Grupo', tag: 'Tag', missing: 'Ausente' }
const MARK: Record<string, string> = { item: 'I', task: 'T', note: 'N', capture: 'C', group: 'G', tag: '#', missing: '!' }
const ALL: RelationKind[] = ['link', 'context', 'project', 'origin', 'tag', 'group']
const clampK = (k: number) => Math.min(3, Math.max(0.1, k))
const MAX_NODES = 150

export function GraphScreen({ focusId }: { focusId?: string }) {
  const { index, navigate } = useAtlas()
  const [view, setView] = useState<View>(() => (focusId && focusId !== savedFocus ? { ...saved, fitted: false, moved: false, selected: focusId, edge: null } : saved))
  const [focus, setFocus] = useState<string | null>(focusId ?? savedFocus)
  const [query, setQuery] = useState('')
  useEffect(() => { saved = view }, [view])
  useEffect(() => { savedFocus = focus }, [focus])
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  const graph = useMemo(() => (index ? buildGraph(index, { relations: view.relations, focusId: focus, depth: view.depth, maxNodes: MAX_NODES, includeArchived: view.archived }) : null), [index, view.relations, focus, view.depth, view.archived])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => { if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [view.list])

  const fit = useCallback(() => {
    if (!graph || size.w === 0) return
    const { minX, minY, maxX, maxY } = graph.bounds
    const k = clampK(Math.min((size.w - 80) / (maxX - minX || 1), (size.h - 80) / (maxY - minY || 1)))
    setView((v) => ({ ...v, k, x: size.w / 2 - ((minX + maxX) / 2) * k, y: size.h / 2 - ((minY + maxY) / 2) * k, fitted: true, moved: false }))
  }, [graph, size])
  useEffect(() => { if (size.w > 0 && (!view.fitted || !view.moved)) fit() }, [view.fitted, fit, size.w, size.h])

  const zoomAt = (f: number, cx = size.w / 2, cy = size.h / 2) => setView((v) => { const k = clampK(v.k * f); return { ...v, k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k, moved: true } })
  const refit = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch, fitted: false, moved: false, edge: null }))
  const focusOn = (id: string | null) => { setFocus(id); refit({ selected: id }) }

  const candidates = useMemo(() => {
    if (!index || !query.trim()) return []
    const q = fold(query.trim())
    return [...index.byId.values()].filter((r) => fold(String(r.metadata.title ?? r.body.slice(0, 80))).includes(q) || r.id.startsWith(q)).slice(0, 8)
  }, [index, query])

  if (!index || !graph) return null
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const selected = view.selected ? nodes.get(view.selected) : undefined
  const selectedEdges = selected ? graph.edges.filter((e) => e.from === selected.id || e.to === selected.id) : []
  const related = new Set(selectedEdges.flatMap((e) => [e.from, e.to]))
  const activeEdge = view.edge !== null ? graph.edges[view.edge] : undefined
  const focusRecord = focus ? index.byId.get(focus) : undefined
  const open = (n: GraphNode | undefined) => { if (n?.record) navigate(routeFor(n.record)) }
  const describe = (e: GraphEdge) => `${nodes.get(e.from)?.label ?? e.from} → ${nodes.get(e.to)?.label ?? e.to}`

  const onKey = (e: React.KeyboardEvent) => {
    const s = 60
    const act: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + s, moved: true })), ArrowRight: () => setView((v) => ({ ...v, x: v.x - s, moved: true })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + s, moved: true })), ArrowDown: () => setView((v) => ({ ...v, y: v.y - s, moved: true })),
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(0.8), '0': fit
    }
    if (e.target === e.currentTarget && act[e.key]) { e.preventDefault(); act[e.key]!() }
  }

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div><h1>Grafo</h1><p className="muted">Links escritos no texto (persistidos) e relações calculadas dos metadados (derivadas). Cada ligação explica a sua origem. Somente leitura.</p></div>
        <div className="row">
          <Button aria-pressed={!view.list} onClick={() => refit({ list: false })}><Network size={16} /> Grafo</Button>
          <Button aria-pressed={view.list} onClick={() => setView((v) => ({ ...v, list: true }))}><List size={16} /> Ver como lista</Button>
        </div>
      </div>

      <section className="card stack-m" aria-label="Controles do grafo">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <label className="label-m" htmlFor="graph-focus">Focar um registro</label>
            <input id="graph-focus" className="input" placeholder={focusRecord ? `Foco: ${String(focusRecord.metadata.title ?? '')}` : 'Buscar por título ou ID…'} value={query} onChange={(e) => setQuery(e.target.value)} />
            {candidates.length > 0 && (
              <div className="card graph-suggest" role="listbox" aria-label="Sugestões de foco">
                {candidates.map((r) => <button key={r.id} role="option" aria-selected={false} className="btn ghost small" style={{ justifyContent: 'flex-start' }} onClick={() => { focusOn(r.id); setQuery('') }}>{String(r.metadata.title || r.body.trim().slice(0, 60))} <span className="muted">· {KIND_LABEL[r.kind]}</span></button>)}
              </div>
            )}
          </div>
          <div className="field" role="group" aria-label="Profundidade">
            <span className="label-m">Profundidade</span>
            <div className="row">{([1, 2, 3] as const).map((d) => <button key={d} type="button" className="tag-toggle" aria-pressed={view.depth === d} disabled={!focus} onClick={() => refit({ depth: d })}>{d} {d === 1 ? 'salto' : 'saltos'}</button>)}</div>
          </div>
          {focus && <Button onClick={() => focusOn(null)}>Visão global</Button>}
        </div>
        <div className="field" role="group" aria-label="Tipos de relação">
          <span className="label-m">Tipos de relação</span>
          <div className="tag-picker">
            {ALL.map((r) => {
              const on = view.relations.includes(r)
              return (
                <button key={r} type="button" className="tag-toggle" aria-pressed={on} onClick={() => refit({ relations: on ? view.relations.filter((x) => x !== r) : [...view.relations, r] })}>
                  <svg width="28" height="10" aria-hidden="true"><line x1="0" y1="5" x2="28" y2="5" className={`graph-edge ${r}`} /></svg>
                  {RELATION_LABEL[r]}{r === 'link' ? ' (persistido)' : ' (derivado)'}
                </button>
              )
            })}
          </div>
        </div>
        <label className="checkbox"><input type="checkbox" checked={view.archived} onChange={(e) => refit({ archived: e.target.checked })} />Incluir arquivados</label>
      </section>

      {graph.truncated && <div className="banner" role="status">Mostrando {graph.nodes.length} de {graph.total} registros relacionados (limite {MAX_NODES}, priorizando os mais conectados{focus ? ' e mais próximos do foco' : ''}). Foque um registro, reduza a profundidade ou desligue tipos de relação para ver o restante.</div>}

      {view.list ? (
        <section aria-label="Relações em lista" className="stack">
          {graph.edges.length === 0 && <Empty>Nenhuma relação com estes filtros.</Empty>}
          {ALL.filter((r) => graph.edges.some((e) => e.kind === r)).map((r) => (
            <section key={r} className="card" aria-label={RELATION_LABEL[r]}>
              <h3 className="section-title">{RELATION_LABEL[r]} <span className="muted body-s">{r === 'link' ? 'persistido no texto' : 'derivado'}</span></h3>
              <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {graph.edges.filter((e) => e.kind === r).map((e, i) => (
                  <li key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="grow stack" style={{ gap: 2 }}>
                      <span className="row">
                        <button className="btn ghost small" onClick={() => open(nodes.get(e.from))}>{nodes.get(e.from)?.label}</button>→
                        {e.broken ? <span className="badge danger">{nodes.get(e.to)?.label}</span> : <button className="btn ghost small" onClick={() => open(nodes.get(e.to))}>{nodes.get(e.to)?.label}</button>}
                      </span>
                      <span className="muted body-s">{e.why}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      ) : (
        <div className="map-wrap">
          <div className="map-toolbar" role="toolbar" aria-label="Zoom do grafo">
            <Button icon aria-label="Aproximar" onClick={() => zoomAt(1.25)}><Plus size={16} /></Button>
            <Button icon aria-label="Afastar" onClick={() => zoomAt(0.8)}><Minus size={16} /></Button>
            <Button icon aria-label="Ajustar à tela" onClick={fit}><Maximize size={16} /></Button>
            <span className="body-s muted">{Math.round(view.k * 100)}% · {graph.nodes.length} nós · {graph.edges.length} relações</span>
          </div>
          <div
            ref={box}
            className="map-canvas"
            tabIndex={0}
            role="application"
            aria-label={`Grafo com ${graph.nodes.length} nós e ${graph.edges.length} relações. Setas movem, + e - aproximam, 0 ajusta. Tab percorre os nós; Enter abre.`}
            onKeyDown={onKey}
            onWheel={(e) => { const r = box.current!.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top) }}
            onPointerDown={(e) => { if ((e.target as Element).closest('.map-node, .graph-hit')) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { const d = drag.current; if (!d) return; d.moved = d.moved || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3; setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y, moved: v.moved || d.moved })) }}
            onPointerUp={() => { if (drag.current && !drag.current.moved) setView((v) => ({ ...v, selected: null, edge: null })); drag.current = null }}
          >
            {graph.nodes.length === 0 && <div className="map-empty">{focus ? 'Este registro não tem relações com os tipos escolhidos.' : 'Nenhuma relação com estes filtros. Escreva links entre notas ou ligue tipos de relação.'}</div>}
            <svg width={Math.max(size.w, 1)} height={Math.max(size.h, 1)}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="graph-arrow" /></marker>
              </defs>
              <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {graph.edges.map((e, i) => {
                  const a = nodes.get(e.from)!, b = nodes.get(e.to)!
                  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
                  const ex = b.x - ((b.x - a.x) / len) * 16, ey = b.y - ((b.y - a.y) / len) * 16
                  const on = view.edge === i || (!!selected && (e.from === selected.id || e.to === selected.id))
                  const dim = (view.edge !== null || !!selected) && !on
                  return (
                    <g key={i} className="graph-hit" onClick={() => setView((v) => ({ ...v, edge: i, selected: null }))}>
                      <title>{e.why}</title>
                      <line x1={a.x} y1={a.y} x2={ex} y2={ey} className="graph-hit-line" />
                      <line x1={a.x} y1={a.y} x2={ex} y2={ey} className={`graph-edge ${e.kind} ${e.broken ? 'broken' : ''} ${on ? 'on' : ''} ${dim ? 'dim' : ''}`} markerEnd={e.persisted ? 'url(#arrow)' : undefined} />
                    </g>
                  )
                })}
                {graph.nodes.map((n) => {
                  const dim = (!!selected && n.id !== selected.id && !related.has(n.id)) || (!!activeEdge && n.id !== activeEdge.from && n.id !== activeEdge.to)
                  const label = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label
                  return (
                    <g key={n.id} className={`map-node graph-node ${n.kind} ${n.id === focus ? 'focus' : ''} ${view.selected === n.id ? 'selected' : ''} ${dim ? 'dim' : ''} ${n.record && isArchived(n.record) ? 'archived' : ''}`}
                      transform={`translate(${n.x},${n.y})`} tabIndex={0} role="button" aria-label={`${label}, ${KIND_LABEL[n.kind]}, ${n.degree} relação(ões)`}
                      onClick={() => setView((v) => ({ ...v, selected: n.id, edge: null }))} onDoubleClick={() => open(n)} onFocus={() => setView((v) => ({ ...v, selected: n.id, edge: null }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); open(n) } }}>
                      <title>{`${n.label} — ${KIND_LABEL[n.kind]}`}</title>
                      <circle r={n.id === focus ? 22 : 14} className="node-shape" />
                      <text className="node-mark" textAnchor="middle" dy="0.35em">{MARK[n.kind]}</text>
                      {(view.k >= 0.5 || n.id === focus || view.selected === n.id) && <text className="node-label" textAnchor="middle" y={(n.id === focus ? 22 : 14) + 15}>{label}</text>}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
          {(selected || activeEdge) && (
            <aside className="card map-panel" aria-label={selected ? 'Nó selecionado' : 'Relação selecionada'} style={{ maxHeight: 'calc(100% - 20px)', overflowY: 'auto' }}>
              {selected ? (
                <>
                  <h3>{selected.label}</h3>
                  <span className="body-s muted">{KIND_LABEL[selected.kind]} · {selectedEdges.length} relação(ões) visíveis</span>
                  <div className="row">
                    {selected.record && <Button kind="primary" small onClick={() => open(selected)}>Abrir</Button>}
                    {selected.id !== focus && selected.kind !== 'missing' && <Button small onClick={() => focusOn(selected.id)}><Crosshair size={14} /> Focar aqui</Button>}
                  </div>
                  <ul className="body-s" style={{ margin: 0, paddingLeft: 18 }}>
                    {selectedEdges.slice(0, 30).map((e, i) => <li key={i}><strong>{RELATION_LABEL[e.kind]}{e.persisted ? '' : ' (derivada)'}:</strong> {describe(e)} — <span className="muted">{e.why}</span></li>)}
                  </ul>
                </>
              ) : activeEdge && (
                <>
                  <h3>{RELATION_LABEL[activeEdge.kind]}</h3>
                  <span className="badge">{activeEdge.persisted ? 'Persistida no texto' : 'Derivada dos metadados'}</span>
                  <p className="body-s" style={{ margin: 0 }}>{describe(activeEdge)}</p>
                  <p className="body-s muted" style={{ margin: 0 }}>{activeEdge.why}</p>
                  <div className="row">
                    <Button small onClick={() => open(nodes.get(activeEdge.from))}>Abrir origem</Button>
                    {!activeEdge.broken && <Button small onClick={() => open(nodes.get(activeEdge.to))}>Abrir destino</Button>}
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
