import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIndex, type RecordView } from '../src/domain/derive.js'
import { buildSearchIndex, fold, parseQuery, sourceCatalog } from '../src/domain/search.js'

const T = '2026-10-19T12:00:00.000Z'
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const base = (n: number, title: string, updated = T) => ({ id: id(n), schema_version: 1, title, created_at: T, updated_at: updated, archived_at: null })
const view = (kind: RecordView['kind'], path: string, metadata: Record<string, unknown>, body = ''): RecordView => ({ kind, id: metadata.id as string, path, revision: 'r', metadata: metadata as never, body, problems: [] })
const item = (n: number, title: string, extra: Record<string, unknown> = {}) => view('item', `items/${id(n)}.md`, { ...base(n, title), type: 'project', tag_ids: [], status: 'active', progress_mode: 'tasks', manual_progress: null, ...extra })
const note = (n: number, title: string, extra: Record<string, unknown>, body = '') => view('note', `notes/${extra.note_type}/${id(n)}.md`, { ...base(n, title), context_item_id: null, tag_ids: [], ...extra }, body)

function fixture() {
  const ux = id(50)
  return buildIndex([
    view('tag', `tags/${ux}.md`, { ...base(50, 'Experiência do usuário'), aliases: ['UX'] }),
    item(1, 'Redesign do aplicativo', { tag_ids: [ux], summary: 'Melhorar a captura' }),
    item(2, 'Curso de cerâmica', { type: 'course', progress_mode: 'manual', manual_progress: 10 }),
    item(3, 'Ideia arquivada sobre café', { type: 'idea', status: 'archived', archived_at: T, progress_mode: 'none' }),
    note(4, 'Leitura: Design de Serviços', { note_type: 'reading', source_title: 'This is Service Design Doing', source_author: 'Stickdorn', source_year: 2018 }, '\nO livro descreve a jornada do usuário e a co-criação.\n\nOutro parágrafo com café.\n'),
    note(5, 'Fichamento cap. 2', { note_type: 'reading', source_title: 'this is service design doing', source_author: 'stickdorn', aliases: ['Capítulo dois'] }, '\nPrototipação rápida.\n'),
    note(6, 'Ideias permanentes', { note_type: 'permanent', tag_ids: [ux] }, '\nCapturar antes de classificar ajuda na experiência.\n'),
    view('capture', `inbox/${id(7)}.md`, { id: id(7), schema_version: 1, title: null, capture_kind: 'thought', status: 'pending', captured_at: T, processed_at: null, archived_at: null, converted_to_type: null, converted_to_id: null }, '\nLembrar de ler sobre cerâmica japonesa\n')
  ])
}

test('fold e parseQuery: sem acento/caixa, frase exata e exclusão', () => {
  assert.equal(fold('Cerâmica ÇÃO'), 'ceramica cao')
  assert.deepEqual(parseQuery('Café "jornada do usuário" -arquivo'), { include: ['cafe', 'jornada do usuario'], exclude: ['arquivo'] })
  assert.deepEqual(parseQuery('   '), { include: [], exclude: [] })
  assert.deepEqual(parseQuery('"design de'), { include: ['design de'], exclude: [] }, 'frase ainda sem aspa de fechamento')
  assert.deepEqual(parseQuery('cafe "jornada do'), { include: ['cafe', 'jornada do'], exclude: [] })
})

test('busca no corpo e nos metadados, sem acento, com trecho do texto original', () => {
  const s = buildSearchIndex(fixture())
  const hits = s.search('jornada usuario')
  assert.deepEqual(hits.map((h) => h.record.id), [id(4)])
  assert.equal(hits[0]!.snippet?.match, 'jornada')
  assert.ok(hits[0]!.snippet!.before.includes('O livro descreve'))
  assert.deepEqual(s.search('ceramica').map((h) => h.record.id).sort(), [id(2), id(7)], 'título do item e corpo da captura')
  assert.deepEqual(s.search('captura').map((h) => h.record.id), [id(1), id(6)], 'resumo (metadados) e prefixo no corpo (Capturar)')
  assert.deepEqual(s.search('stickdorn').map((h) => h.record.id).sort(), [id(4), id(5)], 'autoria da fonte')
  assert.deepEqual(s.search('capitulo dois').map((h) => h.record.id), [id(5)], 'aliases')
  assert.deepEqual(s.search('ux').map((h) => h.record.id).sort(), [id(1), id(6), id(50)], 'alias da tag: a própria Tag e os registros marcados com ela')
})

test('relevância: título pesa mais que corpo; arquivados só quando pedidos; exclusão e frase', () => {
  const s = buildSearchIndex(fixture())
  assert.deepEqual(s.search('cafe').map((h) => h.record.id), [id(4)], 'arquivado oculto por padrão')
  assert.deepEqual(s.search('cafe', { includeArchived: true }).map((h) => h.record.id), [id(3), id(4)], 'título antes de corpo')
  assert.deepEqual(s.search('design -fichamento').map((h) => h.record.id), [id(4), id(1)], 'substring: Redesign também encontra')
  assert.deepEqual(s.search('"co-criação"').map((h) => h.record.id), [id(4)])
  assert.deepEqual(s.search('"criação co"').map((h) => h.record.id), [])
})

test('filtros combináveis: tipo de registro, tipo de item, tipo de nota e tags (OR)', () => {
  const s = buildSearchIndex(fixture())
  assert.deepEqual(s.search('', { kinds: ['note'], noteTypes: ['reading'] }).map((h) => h.record.id).sort(), [id(4), id(5)])
  assert.deepEqual(s.search('', { kinds: ['item'], itemTypes: ['course'] }).map((h) => h.record.id), [id(2)])
  assert.deepEqual(s.search('', { tagIds: [id(50)] }).map((h) => h.record.id).sort(), [id(1), id(6)])
  assert.deepEqual(s.search('melhorar', { kinds: ['note'] }).map((h) => h.record.id), [], 'filtro e termo combinados')
  assert.equal(s.search('').length, 7, 'consulta vazia lista tudo que passa nos filtros')
})

test('catálogo de fontes: agrupa por título+autoria sem caixa/acento, sem entidade nova', () => {
  const catalog = sourceCatalog(fixture())
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0]!.title, 'This is Service Design Doing')
  assert.equal(catalog[0]!.year, 2018)
  assert.deepEqual(catalog[0]!.notes.map((n) => n.id).sort(), [id(4), id(5)])
})

test('desempenho: 1.000 registros indexados e consultados', () => {
  const records: RecordView[] = []
  for (let i = 0; i < 1000; i++) records.push(note(1000 + i, `Nota ${i}`, { note_type: 'permanent' }, `\n${'Lorem ipsum dolor sit amet, consectetur adipiscing. '.repeat(20)} termo${i % 97}\n`))
  const t0 = performance.now()
  const s = buildSearchIndex(buildIndex(records))
  const built = performance.now() - t0
  const t1 = performance.now()
  const hits = s.search('termo5 lorem')
  const queried = performance.now() - t1
  assert.ok(hits.length >= 10)
  console.log(JSON.stringify({ records: 1000, buildMs: Math.round(built), queryMs: Math.round(queried * 10) / 10 }))
  assert.ok(built < 5000 && queried < 1000)
})
