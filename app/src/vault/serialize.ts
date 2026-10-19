import { Document, isScalar, visit } from 'yaml'

// Serialização do frontmatter no estilo dos exemplos (DATA_MODEL §1): datas, timestamps e cores entre
// aspas simples; null/booleanos/inteiros sem aspas; listas vazias como []. A ordem das chaves existentes
// é mantida e chaves novas seguem a ordem canônica, para diffs pequenos em edições externas.
const CANONICAL_ORDER = [
  'id', 'schema_version', 'title', 'created_at', 'updated_at', 'archived_at',
  'type', 'note_type', 'capture_kind', 'status', 'priority', 'progress_mode', 'manual_progress',
  'project_id', 'context_item_id', 'is_next_action', 'due_date', 'sort_order', 'completed_at',
  'summary', 'description', 'objective', 'success_criteria', 'start_date', 'target_date',
  'external_url', 'provider', 'source_title', 'source_author', 'source_url', 'source_year',
  'color', 'icon', 'aliases', 'captured_at', 'processed_at', 'converted_to_type', 'converted_to_id',
  'origin_capture_id', 'tag_ids'
]

const quoted = /^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?|#[0-9A-Fa-f]{6})$/

export function orderKeys(next: Record<string, unknown>, previousOrder: readonly string[] = []): Record<string, unknown> {
  const ordered: Record<string, unknown> = {}
  const rank = (key: string) => {
    const i = CANONICAL_ORDER.indexOf(key)
    return i < 0 ? CANONICAL_ORDER.length : i
  }
  for (const key of previousOrder) if (key in next) ordered[key] = next[key]
  const rest = Object.keys(next).filter((k) => !(k in ordered)).sort((a, b) => rank(a) - rank(b))
  for (const key of rest) ordered[key] = next[key]
  return ordered
}

export function encodeFrontmatter(metadata: Record<string, unknown>, previousOrder?: readonly string[]): string {
  const doc = new Document(orderKeys(metadata, previousOrder))
  visit(doc, {
    Pair(_, pair) {
      if (isScalar(pair.value) && typeof pair.value.value === 'string' && quoted.test(pair.value.value)) pair.value.type = 'QUOTE_SINGLE'
    },
    Seq(_, seq) { if (seq.items.length === 0) seq.flow = true }
  })
  return doc.toString({ lineWidth: 0 })
}

export function encodeRecord(metadata: Record<string, unknown>, body: Buffer, previousOrder?: readonly string[]): Buffer {
  return Buffer.concat([Buffer.from(`---\n${encodeFrontmatter(metadata, previousOrder)}---\n`, 'utf8'), body])
}

// Edição explícita do corpo: mantém CRLF se o corpo original usava exclusivamente CRLF.
export function encodeBody(text: string, originalBody?: Buffer): Buffer {
  const original = originalBody?.toString('utf8') ?? ''
  const usesCrLf = original.includes('\r\n') && !/(^|[^\r])\n/.test(original)
  const normalized = text.replace(/\r\n/g, '\n')
  return Buffer.from(usesCrLf ? normalized.replace(/\n/g, '\r\n') : normalized, 'utf8')
}
