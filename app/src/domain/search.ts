import type { RecordView, VaultIndex } from './derive.js'
import type { EntityKind, ItemStatus, ItemType, NoteType } from './model.js'

// Busca global (V2, D-028): índice em memória, descartável, reconstruído dos registros válidos.
// Sem acento e sem caixa; termos combinados por E; "frase exata"; -termo exclui.

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('pt-BR')
}

// Versão dobrada com mapa de posições para recortar trechos do texto original.
function foldWithMap(text: string): { folded: string; map: number[] } {
  // Caminho rápido: sem marcas combinantes soltas e com comprimento preservado, as posições coincidem.
  const quick = fold(text)
  if (quick.length === text.length && !/\p{M}/u.test(text)) return { folded: quick, map: [] }
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    const f = fold(ch)
    for (let k = 0; k < f.length; k++) map.push(i)
    folded += f
    i += ch.length
  }
  map.push(text.length)
  return { folded, map }
}

export interface ParsedQuery {
  include: string[]
  exclude: string[]
}

export function parseQuery(query: string): ParsedQuery {
  const include: string[] = []
  const exclude: string[] = []
  // Aspa de fechamento opcional: durante a digitação de "frase incompleta, já busca a frase.
  const pattern = /(-?)"([^"]*)(?:"|$)|(-?)(\S+)/g
  for (const m of query.matchAll(pattern)) {
    const negative = (m[1] ?? m[3]) === '-'
    // Aspas soltas dentro de um termo (design") não fazem parte do texto procurado.
    const term = fold((m[2] ?? (m[4] ?? '').replace(/"/g, '')).trim())
    if (!term || term === '-') continue
    ;(negative ? exclude : include).push(term)
  }
  return { include, exclude }
}

type Field = 'title' | 'aliases' | 'tags' | 'meta' | 'body'
const WEIGHT: Record<Field, number> = { title: 8, aliases: 5, tags: 4, meta: 2, body: 1 }

interface Doc {
  record: RecordView
  fields: Record<Field, string>
  // Todos os campos dobrados juntos, para a exclusão (-termo); calculado uma vez por índice.
  all: string
  body: { folded: string; map: number[] }
}

export interface SearchFilters {
  kinds?: EntityKind[]
  itemTypes?: ItemType[]
  itemStatuses?: ItemStatus[]
  noteTypes?: NoteType[]
  // Registro com qualquer uma das tags (OR, como os grupos); vazio = sem filtro.
  tagIds?: string[]
  includeArchived?: boolean
}

export interface SearchHit {
  record: RecordView
  score: number
  matchedFields: Field[]
  snippet: { before: string; match: string; after: string } | null
}

export interface SearchIndex {
  size: number
  search(query: string, filters?: SearchFilters, limit?: number): SearchHit[]
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function titleOf(r: RecordView): string {
  const t = str(r.metadata.title)
  if (t) return t
  return r.body.trim().split(/\r?\n/)[0] ?? ''
}

export function isArchived(r: RecordView): boolean {
  if (r.metadata.archived_at) return true
  return (r.kind === 'item' && r.metadata.status === 'archived') || (r.kind === 'capture' && r.metadata.status === 'archived')
}

export function buildSearchIndex(index: VaultIndex): SearchIndex {
  const tagTitle = new Map(index.tags.map((t) => [t.id, [t.metadata.title, ...(t.metadata.aliases ?? [])].join(' ')]))
  const docs: Doc[] = [...index.byId.values()].map((record) => {
    const m = record.metadata as Record<string, unknown>
    const meta = [
      m.summary, m.objective, m.description, m.provider, m.external_url,
      m.source_title, m.source_author, m.source_url, m.source_year === undefined || m.source_year === null ? '' : String(m.source_year),
      ...list(m.success_criteria)
    ].map(str).filter(Boolean).join(' \n ')
    return {
      record,
      fields: {
        title: fold(titleOf(record)),
        aliases: fold(list(m.aliases).join(' \n ')),
        tags: fold(list(m.tag_ids).map((id) => tagTitle.get(id) ?? '').join(' \n ')),
        meta: fold(meta),
        body: ''
      },
      all: '',
      body: foldWithMap(record.body)
    }
  })
  for (const d of docs) {
    d.fields.body = d.body.folded
    d.all = `${d.fields.title}\n${d.fields.aliases}\n${d.fields.tags}\n${d.fields.meta}\n${d.fields.body}`
  }

  return {
    size: docs.length,
    search(query, filters = {}, limit = 200) {
      const q = parseQuery(query)
      const hits: SearchHit[] = []
      for (const d of docs) {
        const r = d.record
        if (!passes(r, filters)) continue
        if (q.exclude.length > 0 && q.exclude.some((t) => d.all.includes(t))) continue
        let score = 0
        const matched = new Set<Field>()
        let ok = true
        for (const term of q.include) {
          let termScore = 0
          for (const f of Object.keys(WEIGHT) as Field[]) {
            if (d.fields[f].includes(term)) { termScore += WEIGHT[f]; matched.add(f) }
          }
          if (termScore === 0) { ok = false; break }
          if (d.fields.title.startsWith(term)) termScore += 3
          score += termScore
        }
        if (!ok) continue
        if (q.include.length === 0) score = 0
        hits.push({ record: r, score, matchedFields: [...matched], snippet: snippet(d, q.include) })
      }
      hits.sort((a, b) => b.score - a.score || String(b.record.metadata.updated_at ?? b.record.metadata.captured_at ?? '').localeCompare(String(a.record.metadata.updated_at ?? a.record.metadata.captured_at ?? '')))
      return hits.slice(0, limit)
    }
  }
}

function passes(r: RecordView, f: SearchFilters): boolean {
  if (!f.includeArchived && isArchived(r)) return false
  if (f.kinds?.length && !f.kinds.includes(r.kind)) return false
  const m = r.metadata as Record<string, unknown>
  if (f.itemTypes?.length && (r.kind !== 'item' || !f.itemTypes.includes(m.type as ItemType))) return false
  if (f.itemStatuses?.length && (r.kind !== 'item' || !f.itemStatuses.includes(m.status as ItemStatus))) return false
  if (f.noteTypes?.length && (r.kind !== 'note' || !f.noteTypes.includes(m.note_type as NoteType))) return false
  if (f.tagIds?.length) {
    const tags = list(m.tag_ids)
    if (!f.tagIds.some((id) => tags.includes(id))) return false
  }
  return true
}

function snippet(d: Doc, terms: string[]): SearchHit['snippet'] {
  const text = d.record.body
  for (const term of terms) {
    const at = d.body.folded.indexOf(term)
    if (at < 0) continue
    const identity = d.body.map.length === 0
    const start = identity ? at : d.body.map[at]!
    const end = identity ? at + term.length : d.body.map[at + term.length] ?? text.length
    const from = Math.max(0, start - 60)
    const to = Math.min(text.length, end + 80)
    const clean = (s: string) => s.replace(/\s+/g, ' ')
    return { before: (from > 0 ? '…' : '') + clean(text.slice(from, start)).trimStart(), match: text.slice(start, end), after: clean(text.slice(end, to)).trimEnd() + (to < text.length ? '…' : '') }
  }
  return null
}

// Catálogo de fontes (D-028): derivado de source_* das notas, sem entidade nova nem campo novo.
export interface SourceEntry {
  key: string
  title: string
  author: string | null
  year: number | null
  url: string | null
  notes: RecordView<'note'>[]
}

export function sourceCatalog(index: VaultIndex, includeArchived = false): SourceEntry[] {
  const map = new Map<string, SourceEntry>()
  for (const n of index.notes) {
    if (!includeArchived && n.metadata.archived_at) continue
    const title = (n.metadata.source_title ?? '').trim()
    const url = (n.metadata.source_url ?? '').trim()
    if (!title && !url) continue
    const author = (n.metadata.source_author ?? '').trim() || null
    const key = title ? `${fold(title)}\u0000${fold(author ?? '')}` : `url\u0000${url}`
    const entry = map.get(key) ?? { key, title: title || url, author, year: n.metadata.source_year ?? null, url: url || null, notes: [] }
    // Prefere a grafia com maiúsculas quando a mesma fonte foi escrita de formas diferentes.
    if (title && entry.title === entry.title.toLowerCase() && title !== title.toLowerCase()) entry.title = title
    if (author && (!entry.author || (entry.author === entry.author.toLowerCase() && author !== author.toLowerCase()))) entry.author = author
    if (!entry.url && url) entry.url = url
    if (entry.year === null && typeof n.metadata.source_year === 'number') entry.year = n.metadata.source_year
    entry.notes.push(n)
    map.set(key, entry)
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}
