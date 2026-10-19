import { itemGroups, type RecordView, type VaultIndex } from './derive.js'
import type { EntityKind } from './model.js'
import { isArchived } from './search.js'

// Grafo de conhecimento V4 (D-030). Distingue relações PERSISTIDAS (links Markdown escritos no corpo,
// D-009) de relações DERIVADAS (calculadas de campos YAML ou de regras). Somente leitura e determinístico.

export type RelationKind = 'link' | 'context' | 'project' | 'origin' | 'tag' | 'group'
export const PERSISTED: ReadonlySet<RelationKind> = new Set(['link'])
export const RELATION_LABEL: Record<RelationKind, string> = {
  link: 'Link no texto',
  context: 'Contexto da nota',
  project: 'Tarefa do projeto',
  origin: 'Origem na captura',
  tag: 'Marcado com a tag',
  group: 'Pertence ao grupo (OR de tags)'
}
export const DEFAULT_RELATIONS: RelationKind[] = ['link', 'context', 'project', 'origin']

export interface GraphNode {
  id: string
  kind: EntityKind | 'missing'
  label: string
  x: number
  y: number
  degree: number
  depth: number | null
  record?: RecordView
}

export interface GraphEdge {
  from: string
  to: string
  kind: RelationKind
  persisted: boolean
  // Explicação legível de por que a relação existe (critério “relações explicáveis”).
  why: string
  broken?: boolean
}

export interface GraphOptions {
  relations?: RelationKind[]
  focusId?: string | null
  depth?: 1 | 2 | 3
  maxNodes?: number
  includeArchived?: boolean
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  total: number
  truncated: boolean
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

const title = (r: RecordView) => String(r.metadata.title || r.body.trim().split(/\r?\n/)[0] || r.id.slice(0, 8))

// Todas as relações do vault, antes de foco e limites.
export function allRelations(index: VaultIndex, relations: readonly RelationKind[], includeArchived: boolean): { edges: GraphEdge[]; missing: Map<string, string> } {
  const want = new Set(relations)
  const visible = (r: RecordView | undefined) => !!r && (includeArchived || !isArchived(r))
  const edges: GraphEdge[] = []
  const missing = new Map<string, string>()
  const seen = new Set<string>()
  const push = (e: GraphEdge) => {
    const key = `${e.kind}:${e.from}:${e.to}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push(e)
  }
  for (const r of index.byId.values()) {
    if (!visible(r)) continue
    const m = r.metadata as Record<string, unknown>
    if (want.has('link')) {
      for (const link of index.outgoing.get(r.id) ?? []) {
        if (link.kind === 'record' && link.targetId && link.targetId !== r.id) {
          const target = index.byId.get(link.targetId)
          if (visible(target)) push({ from: r.id, to: link.targetId, kind: 'link', persisted: true, why: `Link “${link.text || link.href}” escrito no corpo de “${title(r)}”` })
        } else if (link.kind === 'missing' && link.targetPath) {
          const id = `missing:${link.targetPath}`
          missing.set(id, link.targetPath)
          push({ from: r.id, to: id, kind: 'link', persisted: true, broken: true, why: `Link quebrado no corpo de “${title(r)}”: ${link.href} não existe` })
        }
      }
    }
    if (want.has('context') && r.kind === 'note' && typeof m.context_item_id === 'string') {
      const target = index.byId.get(m.context_item_id)
      if (visible(target)) push({ from: r.id, to: m.context_item_id, kind: 'context', persisted: false, why: `context_item_id da nota “${title(r)}”` })
    }
    if (want.has('project') && r.kind === 'task' && typeof m.project_id === 'string') {
      const target = index.byId.get(m.project_id)
      if (visible(target)) push({ from: r.id, to: m.project_id, kind: 'project', persisted: false, why: `project_id da tarefa “${title(r)}”` })
    }
    if (want.has('origin') && typeof m.origin_capture_id === 'string') {
      const target = index.byId.get(m.origin_capture_id)
      if (visible(target)) push({ from: r.id, to: m.origin_capture_id, kind: 'origin', persisted: false, why: `origin_capture_id de “${title(r)}”` })
    }
    if (want.has('tag') && (r.kind === 'item' || r.kind === 'note') && Array.isArray(m.tag_ids)) {
      for (const tagId of m.tag_ids as string[]) {
        const tag = index.byId.get(tagId)
        if (visible(tag)) push({ from: r.id, to: tagId, kind: 'tag', persisted: false, why: `tag_ids de “${title(r)}” inclui “${title(tag!)}”` })
      }
    }
    if (want.has('group') && r.kind === 'item') {
      for (const g of itemGroups(index, r.metadata as never)) {
        if (!visible(g)) continue
        const shared = (r.metadata as { tag_ids: string[] }).tag_ids.filter((t) => g.metadata.tag_ids.includes(t)).map((t) => title(index.byId.get(t)!)).join(', ')
        push({ from: r.id, to: g.id, kind: 'group', persisted: false, why: `Derivado: compartilha a(s) tag(s) ${shared} com o grupo “${g.metadata.title}” (D-004)` })
      }
    }
  }
  return { edges, missing }
}

// Pseudoaleatório determinístico a partir do UUID (posições iniciais estáveis).
function seed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

export function buildGraph(index: VaultIndex, options: GraphOptions = {}): Graph {
  const relations = options.relations ?? DEFAULT_RELATIONS
  const maxNodes = options.maxNodes ?? 150
  const { edges: all, missing } = allRelations(index, relations, !!options.includeArchived)
  const adjacency = new Map<string, Set<string>>()
  const link = (a: string, b: string) => { adjacency.set(a, (adjacency.get(a) ?? new Set()).add(b)) }
  for (const e of all) { link(e.from, e.to); link(e.to, e.from) }

  // Navegação controlada: com foco, só os nós até `depth` saltos; sem foco, os nós com relações.
  const depthOf = new Map<string, number>()
  let candidates: string[]
  const focus = options.focusId && (index.byId.has(options.focusId) || missing.has(options.focusId)) ? options.focusId : null
  if (focus) {
    const limit = options.depth ?? 1
    depthOf.set(focus, 0)
    let frontier = [focus]
    for (let d = 1; d <= limit; d++) {
      const next: string[] = []
      for (const id of frontier) for (const n of [...(adjacency.get(id) ?? [])].sort()) if (!depthOf.has(n)) { depthOf.set(n, d); next.push(n) }
      frontier = next
    }
    candidates = [...depthOf.keys()]
  } else {
    candidates = [...adjacency.keys()]
  }
  const total = candidates.length
  const degree = (id: string) => adjacency.get(id)?.size ?? 0
  // Limite para conjuntos grandes: mantém o foco e os nós mais próximos e mais conectados.
  candidates.sort((a, b) => (depthOf.get(a) ?? 0) - (depthOf.get(b) ?? 0) || degree(b) - degree(a) || a.localeCompare(b))
  const kept = new Set(candidates.slice(0, maxNodes))
  const edges = all.filter((e) => kept.has(e.from) && kept.has(e.to))

  const nodes: GraphNode[] = [...kept].sort().map((id) => {
    const record = index.byId.get(id)
    return {
      id,
      kind: record ? record.kind : 'missing',
      label: record ? title(record) : `Ausente: ${missing.get(id) ?? id}`,
      x: 0, y: 0,
      degree: degree(id),
      depth: depthOf.get(id) ?? null,
      ...(record ? { record } : {})
    }
  })
  layout(nodes, edges, focus)
  const xs = nodes.flatMap((n) => [n.x - 30, n.x + 30])
  const ys = nodes.flatMap((n) => [n.y - 30, n.y + 30])
  return { nodes, edges, total, truncated: total > kept.size, bounds: nodes.length ? { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } : { minX: -100, minY: -100, maxX: 100, maxY: 100 } }
}

// Com foco: anéis concêntricos por distância. Sem foco: forças com semente e número fixo de iterações.
function layout(nodes: GraphNode[], edges: GraphEdge[], focus: string | null): void {
  if (nodes.length === 0) return
  if (focus) {
    const rings = new Map<number, GraphNode[]>()
    for (const n of nodes) rings.set(n.depth ?? 0, [...(rings.get(n.depth ?? 0) ?? []), n])
    for (const [d, ring] of rings) {
      ring.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'pt-BR') || a.id.localeCompare(b.id))
      const radius = d === 0 ? 0 : Math.max(d * 220, (ring.length * 70) / (2 * Math.PI))
      ring.forEach((n, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length + (d % 2 ? 0 : Math.PI / ring.length)
        n.x = d === 0 ? 0 : Math.cos(a) * radius
        n.y = d === 0 ? 0 : Math.sin(a) * radius
      })
    }
    return
  }
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const size = Math.sqrt(nodes.length) * 80
  for (const n of nodes) { n.x = (seed(n.id) - 0.5) * size; n.y = (seed(`${n.id}y`) - 0.5) * size }
  const k = 75
  for (let iter = 0; iter < 220; iter++) {
    const t = size * 0.1 * (1 - iter / 220) + 1
    const dx = new Float64Array(nodes.length)
    const dy = new Float64Array(nodes.length)
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      let x = nodes[i]!.x - nodes[j]!.x, y = nodes[i]!.y - nodes[j]!.y
      let d = Math.hypot(x, y)
      if (d < 0.01) { x = 0.01 * (i - j); y = 0.01; d = Math.hypot(x, y) }
      const f = (k * k) / d
      dx[i]! += (x / d) * f; dy[i]! += (y / d) * f
      dx[j]! -= (x / d) * f; dy[j]! -= (y / d) * f
    }
    for (const e of edges) {
      const i = index.get(e.from)!, j = index.get(e.to)!
      const x = nodes[i]!.x - nodes[j]!.x, y = nodes[i]!.y - nodes[j]!.y
      const d = Math.max(Math.hypot(x, y), 0.01)
      const f = (d * d) / k
      dx[i]! -= (x / d) * f; dy[i]! -= (y / d) * f
      dx[j]! += (x / d) * f; dy[j]! += (y / d) * f
    }
    for (let i = 0; i < nodes.length; i++) {
      // Gravidade leve para componentes desconexos não se afastarem indefinidamente.
      dx[i]! -= nodes[i]!.x * 0.06; dy[i]! -= nodes[i]!.y * 0.06
      const d = Math.max(Math.hypot(dx[i]!, dy[i]!), 0.01)
      nodes[i]!.x += (dx[i]! / d) * Math.min(d, t)
      nodes[i]!.y += (dy[i]! / d) * Math.min(d, t)
    }
  }
}
