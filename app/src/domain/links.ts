import MarkdownIt from 'markdown-it'

// Links Markdown relativos (D-009; VAULT_CONTRACT §5). Puro: caminhos relativos à raiz do vault com '/'.
const markdown = new MarkdownIt('commonmark', { html: false, linkify: false })
const uriScheme = /^[a-z][a-z0-9+.-]*:/i
const recordFile = /^(groups|tags|items|tasks|inbox|notes\/work|notes\/reading|notes\/permanent)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/

export interface LinkRef {
  href: string
  text: string
  kind: 'record' | 'external' | 'asset' | 'missing' | 'outside' | 'anchor' | 'invalid'
  // Para kind 'record' e 'missing' (quando o alvo parece um registro).
  targetPath?: string
  targetId?: string
  fragment?: string
}

function dirOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index < 0 ? '' : path.slice(0, index)
}

// Resolve `href` relativo ao arquivo `fromPath`; null se sair da raiz.
export function resolveRelative(fromPath: string, href: string): string | null {
  const segments = dirOf(fromPath).split('/').filter(Boolean)
  for (const part of href.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (segments.length === 0) return null
      segments.pop()
    } else segments.push(part)
  }
  return segments.join('/')
}

// Caminho relativo de `fromPath` (arquivo) até `toPath` (arquivo), ambos relativos à raiz.
export function relativeHref(fromPath: string, toPath: string): string {
  const from = dirOf(fromPath).split('/').filter(Boolean)
  const to = toPath.split('/')
  let common = 0
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++
  const ups = from.length - common
  const rest = to.slice(common).join('/')
  return ups === 0 ? `./${rest}`.replace(/^\.\//, '') : `${'../'.repeat(ups)}${rest}`
}

// Escapa colchetes e barras invertidas do texto visível do link.
export function linkLabel(title: string): string {
  return title.replace(/[\\[\]]/g, (c) => `\\${c}`)
}

export function markdownLink(fromPath: string, toPath: string, title: string): string {
  return `[${linkLabel(title)}](${encodeURI(relativeHref(fromPath, toPath))})`
}

export function extractLinks(fromPath: string, body: string, knownPaths: ReadonlySet<string>): LinkRef[] {
  const result: LinkRef[] = []
  for (const block of markdown.parse(body, {})) {
    if (block.type !== 'inline' || !block.children) continue
    let current: LinkRef | null = null
    for (const token of block.children) {
      if (token.type === 'link_open') {
        current = classify(fromPath, String(token.attrGet('href') ?? ''), knownPaths)
        result.push(current)
      } else if (token.type === 'link_close') current = null
      else if (current && (token.type === 'text' || token.type === 'code_inline')) current.text += token.content
    }
  }
  return result
}

function classify(fromPath: string, href: string, knownPaths: ReadonlySet<string>): LinkRef {
  const base = { href, text: '' }
  if (href.startsWith('#')) return { ...base, kind: 'anchor' }
  if (href.startsWith('//') || uriScheme.test(href)) return { ...base, kind: 'external' }
  const [pathPart, ...hashParts] = href.split('#')
  if (!pathPart || pathPart.includes('?')) return { ...base, kind: 'invalid' }
  let decoded: string
  try { decoded = decodeURI(pathPart) } catch { return { ...base, kind: 'invalid' } }
  if (decoded.includes('\\')) return { ...base, kind: 'invalid' }
  const target = resolveRelative(fromPath, decoded)
  if (target === null) return { ...base, kind: 'outside' }
  const fragment = hashParts.length > 0 ? hashParts.join('#') : undefined
  const match = recordFile.exec(target)
  if (match) {
    return { ...base, kind: knownPaths.has(target) ? 'record' : 'missing', targetPath: target, targetId: match[2], ...(fragment ? { fragment } : {}) }
  }
  if (target.startsWith('assets/')) return { ...base, kind: 'asset', targetPath: target }
  return { ...base, kind: knownPaths.has(target) ? 'record' : 'missing', targetPath: target }
}
