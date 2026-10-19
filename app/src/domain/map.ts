import { groupItems, itemGroups, itemNotes, type RecordView, type VaultIndex } from './derive.js'
import type { ItemStatus, ItemType } from './model.js'
import { isArchived } from './search.js'

// Mapa visual V3 (D-029): projeção somente leitura das entidades existentes. Posições são
// calculadas de forma determinística a cada render; nada é persistido (D-011).
// Hub no centro (D-010), grupos no primeiro anel, itens no segundo, perto dos seus grupos
// (item com vários grupos fica entre eles, com uma aresta para cada), notas de contexto ao redor do item.

export type MapNodeKind = 'hub' | 'group' | 'ungrouped' | 'item' | 'note'

export interface MapNode {
  id: string
  kind: MapNodeKind
  label: string
  x: number
  y: number
  r: number
  color: string | null
  record?: RecordView
  // Para itens: grupos aos quais pertence (vazio = Sem grupo).
  groupIds?: string[]
}

export interface MapEdge {
  from: string
  to: string
  kind: 'hub' | 'membership' | 'context'
}

export interface MapFilters {
  itemTypes?: ItemType[]
  itemStatuses?: ItemStatus[]
  tagIds?: string[]
  includeArchived?: boolean
  showNotes?: boolean
}

export interface MapLayout {
  nodes: MapNode[]
  edges: MapEdge[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const HUB_ID = 'hub'
export const UNGROUPED_ID = 'ungrouped'
const R_GROUP = 260
const R_ITEM = 520
const R_SHARED = 400
const ROW_GAP = 84
const ITEM_GAP = 100

function circularMean(angles: number[]): number {
  const x = angles.reduce((s, a) => s + Math.cos(a), 0)
  const y = angles.reduce((s, a) => s + Math.sin(a), 0)
  return Math.atan2(y, x)
}

export function visibleItems(index: VaultIndex, f: MapFilters): RecordView<'item'>[] {
  return index.items.filter((i) => {
    const m = i.metadata
    if (!f.includeArchived && isArchived(i)) return false
    if (f.itemTypes?.length && !f.itemTypes.includes(m.type)) return false
    if (f.itemStatuses?.length && !f.itemStatuses.includes(m.status)) return false
    if (f.tagIds?.length && !f.tagIds.some((t) => m.tag_ids.includes(t))) return false
    return true
  })
}

export function buildMapLayout(index: VaultIndex, filters: MapFilters = {}): MapLayout {
  const items = visibleItems(index, filters)
  const groups = index.groups.filter((g) => filters.includeArchived || !g.metadata.archived_at)
  const groupOf = new Map<string, string[]>()
  for (const item of items) groupOf.set(item.id, itemGroups(index, item.metadata).filter((g) => groups.includes(g)).map((g) => g.id))
  const hasUngrouped = items.some((i) => groupOf.get(i.id)!.length === 0)

  const ring = [...groups.map((g) => ({ id: g.id, label: g.metadata.title, color: g.metadata.color ?? null, record: g as RecordView })), ...(hasUngrouped ? [{ id: UNGROUPED_ID, label: 'Sem grupo', color: null, record: undefined }] : [])]
  const angle = new Map<string, number>()
  const nodes: MapNode[] = [{ id: HUB_ID, kind: 'hub', label: 'ATLAS DE INTERESSES', x: 0, y: 0, r: 70, color: null }]
  const edges: MapEdge[] = []
  ring.forEach((g, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(ring.length, 1)
    angle.set(g.id, a)
    nodes.push({ id: g.id, kind: g.id === UNGROUPED_ID ? 'ungrouped' : 'group', label: g.label, x: Math.cos(a) * R_GROUP, y: Math.sin(a) * R_GROUP, r: 34, color: g.color, ...(g.record ? { record: g.record } : {}) })
    edges.push({ from: HUB_ID, to: g.id, kind: 'hub' })
  })

  // Itens agrupados pelo conjunto exato de grupos; cada conjunto ocupa um setor perto da média dos ângulos.
  const sector = (2 * Math.PI) / Math.max(ring.length, 1)
  const buckets = new Map<string, RecordView<'item'>[]>()
  for (const item of items) {
    const ids = groupOf.get(item.id)!
    const key = ids.length ? [...ids].sort().join('|') : UNGROUPED_ID
    buckets.set(key, [...(buckets.get(key) ?? []), item])
  }
  for (const [key, bucket] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ids = key === UNGROUPED_ID ? [UNGROUPED_ID] : key.split('|')
    const base = ids.length === 1 ? angle.get(ids[0]!)! : circularMean(ids.map((id) => angle.get(id)!))
    const radius = ids.length === 1 ? R_ITEM : R_SHARED
    const sorted = [...bucket].sort((a, b) => a.metadata.title.localeCompare(b.metadata.title, 'pt-BR') || a.id.localeCompare(b.id))
    // Até `perRow` itens por arco; mais itens formam arcos externos.
    const span = ids.length === 1 ? sector * 0.8 : sector * 0.5
    const perRow = Math.max(1, Math.floor((span * radius) / ITEM_GAP))
    sorted.forEach((item, i) => {
      const row = Math.floor(i / perRow)
      const inRow = Math.min(perRow, sorted.length - row * perRow)
      const pos = i % perRow
      const rr = radius + row * ROW_GAP
      const step = inRow > 1 ? Math.min(span / (inRow - 1), ITEM_GAP / rr) : 0
      const a = base + (pos - (inRow - 1) / 2) * step
      nodes.push({ id: item.id, kind: 'item', label: item.metadata.title, x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 18, color: null, record: item, groupIds: groupOf.get(item.id)! })
      for (const g of ids) edges.push({ from: g, to: item.id, kind: 'membership' })
    })
  }

  if (filters.showNotes) {
    const placed = new Map(nodes.map((n) => [n.id, n]))
    for (const item of items) {
      const at = placed.get(item.id)!
      const notes = itemNotes(index, item.id).filter((n) => filters.includeArchived || !n.metadata.archived_at)
      const outward = Math.atan2(at.y, at.x)
      notes.forEach((note, i) => {
        const a = outward + (i - (notes.length - 1) / 2) * 0.5
        nodes.push({ id: note.id, kind: 'note', label: note.metadata.title, x: at.x + Math.cos(a) * 46, y: at.y + Math.sin(a) * 46, r: 9, color: null, record: note })
        edges.push({ from: item.id, to: note.id, kind: 'context' })
      })
    }
  }

  const xs = nodes.map((n) => [n.x - n.r, n.x + n.r]).flat()
  const ys = nodes.map((n) => [n.y - n.r, n.y + n.r]).flat()
  return { nodes, edges, bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } }
}

// Alternativa em listas (D-029): a mesma estrutura do mapa, em ordem de leitura.
export interface MapOutlineGroup {
  id: string
  label: string
  items: RecordView<'item'>[]
}

export function mapOutline(index: VaultIndex, filters: MapFilters = {}): MapOutlineGroup[] {
  const items = new Set(visibleItems(index, filters).map((i) => i.id))
  const groups = index.groups.filter((g) => filters.includeArchived || !g.metadata.archived_at)
  const outline: MapOutlineGroup[] = groups.map((g) => ({ id: g.id, label: g.metadata.title, items: groupItems(index, g.metadata).filter((i) => items.has(i.id)) }))
  const grouped = new Set(outline.flatMap((g) => g.items.map((i) => i.id)))
  const ungrouped = index.items.filter((i) => items.has(i.id) && !grouped.has(i.id))
  if (ungrouped.length) outline.push({ id: UNGROUPED_ID, label: 'Sem grupo', items: ungrouped })
  return outline
}
