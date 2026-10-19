import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { encodeFrontmatter } from '../src/vault/serialize.js'
import { VaultError, VaultRepository } from '../src/vault/repository.js'
import { parseFrontmatterDocument } from '../src/vault/core/frontmatter.js'

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
let clockValue = Date.parse('2026-10-19T12:00:00.000Z')
const clock = () => new Date((clockValue += 1000))

async function vault(t: TestContext): Promise<VaultRepository> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-repo-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = new VaultRepository(root, undefined, clock)
  await repo.ensureStructure()
  await repo.load()
  return repo
}

test('serialização segue o estilo dos exemplos: datas/cores entre aspas simples, [] e null sem aspas', () => {
  const yaml = encodeFrontmatter({ tag_ids: [], title: 'X', id: '11111111-1111-4111-8111-111111111111', created_at: '2026-10-18T12:00:00.000Z', target_date: '2026-11-01', color: '#241F6F', manual_progress: null, is_next_action: false })
  assert.equal(yaml, [
    'id: 11111111-1111-4111-8111-111111111111',
    'title: X',
    "created_at: '2026-10-18T12:00:00.000Z'",
    'manual_progress: null',
    'is_next_action: false',
    "target_date: '2026-11-01'",
    "color: '#241F6F'",
    'tag_ids: []',
    ''
  ].join('\n'))
})

test('cria Tag, Group e Item; UUID v4 novo; reabre do disco com os mesmos dados', async (t) => {
  const repo = await vault(t)
  const tag = await repo.create('tag', { title: 'UX', description: '', color: null, aliases: [] })
  const group = await repo.create('group', { title: 'Design', tag_ids: [tag.id], sort_order: 0 })
  const item = await repo.create('item', { title: 'Projeto', type: 'project', status: 'backlog', tag_ids: [tag.id], progress_mode: 'tasks', manual_progress: null }, '# Projeto\n')
  assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(item.path, `items/${item.id}.md`)

  const reopened = new VaultRepository(repo.root)
  const report = await reopened.load()
  assert.deepEqual(report.invalid, [])
  const views = new Map(reopened.views().map((v) => [v.id, v]))
  assert.deepEqual(views.get(item.id)?.metadata, item.metadata)
  assert.equal(views.get(item.id)?.body, '\n# Projeto\n')
  assert.deepEqual((views.get(group.id)?.metadata as { tag_ids: string[] }).tag_ids, [tag.id])
})

test('D-006: edição só de metadados preserva os bytes do corpo (LF, CRLF, sem newline final) e campos desconhecidos', async (t) => {
  const repo = await vault(t)
  const id = '44444444-4444-4444-8444-444444444444'
  for (const [label, body] of [['LF', '\n# T\n\ntexto  \n```\nx\n```\n'], ['CRLF', '\r\n# T\r\n\r\nlinha\r\n'], ['sem final', '\nsem newline final']] as const) {
    const file = join(repo.root, 'items', `${id}.md`)
    await rm(file, { force: true })
    const header = `---\nid: ${id}\nschema_version: 1\ntitle: Antigo\ncreated_at: '2026-10-18T12:00:00.000Z'\nupdated_at: '2026-10-18T12:00:00.000Z'\narchived_at: null\ntype: idea\nstatus: backlog\nprogress_mode: none\nmanual_progress: null\ntag_ids: []\ncampo_futuro: preservado\n---\n`
    await writeFile(file, Buffer.from(header + body, 'utf8'))
    await repo.load()
    const original = parseFrontmatterDocument(await readFile(file))
    const view = repo.views().find((v) => v.id === id)!
    const saved = await repo.update(id, view.revision, { ...view.metadata, title: 'Novo' })
    const after = parseFrontmatterDocument(await readFile(file))
    assert.equal(sha(after.body), sha(original.body), label)
    assert.equal(after.metadata.title, 'Novo')
    assert.equal(after.metadata.campo_futuro, 'preservado')
    assert.equal(after.metadata.created_at, '2026-10-18T12:00:00.000Z')
    assert.notEqual(saved.metadata.updated_at, '2026-10-18T12:00:00.000Z')
    assert.equal(saved.id, id, 'UUID estável')
  }
})

test('edição explícita do corpo mantém CRLF do original', async (t) => {
  const repo = await vault(t)
  const note = await repo.create('note', { title: 'N', note_type: 'reading', context_item_id: null, tag_ids: [] }, 'a\n')
  const file = join(repo.root, ...note.path.split('/'))
  const crlf = (await readFile(file, 'utf8')).replace(/\n/g, '\r\n').replace('---\r\n', '---\n')
  await writeFile(file, crlf)
  await repo.load()
  const v = repo.views().find((x) => x.id === note.id)!
  await repo.update(note.id, v.revision, v.metadata, 'linha 1\nlinha 2\n')
  assert.ok((await readFile(file, 'utf8')).endsWith('linha 1\r\nlinha 2\r\n'))
})

test('conflito externo: nada é sobrescrito, a versão externa é devolvida', async (t) => {
  const repo = await vault(t)
  const tag = await repo.create('tag', { title: 'Original' })
  const file = join(repo.root, ...tag.path.split('/'))
  const external = (await readFile(file, 'utf8')).replace('title: Original', 'title: Externo')
  await writeFile(file, external)
  await assert.rejects(repo.update(tag.id, tag.revision, { ...tag.metadata, title: 'Meu' }), (e: unknown) => e instanceof VaultError && e.code === 'conflict' && String(e.details.external).includes('Externo'))
  assert.equal(await readFile(file, 'utf8'), external)
  assert.deepEqual((await readdir(join(repo.root, 'tags'))).filter((n) => n.startsWith('.tmp-')), [], 'temporário próprio removido')
})

test('recusa referências inválidas, UUID alterado, mudança de note_type e registro inválido sem gravar', async (t) => {
  const repo = await vault(t)
  const idea = await repo.create('item', { title: 'Ideia', type: 'idea', status: 'backlog', tag_ids: [], progress_mode: 'none', manual_progress: null })
  await assert.rejects(repo.create('task', { title: 'T', status: 'todo', project_id: idea.id, is_next_action: false, sort_order: 0, completed_at: null }), /project/)
  await assert.rejects(repo.create('item', { title: 'X', type: 'idea', status: 'backlog', tag_ids: ['99999999-9999-4999-8999-999999999999'], progress_mode: 'none', manual_progress: null }), /tag/)
  await assert.rejects(repo.create('item', { title: '  ', type: 'idea', status: 'backlog', tag_ids: [], progress_mode: 'none', manual_progress: null }), /title/)
  await assert.rejects(repo.update(idea.id, idea.revision, { ...idea.metadata, id: '99999999-9999-4999-8999-999999999999' }), /imutável/)
  const note = await repo.create('note', { title: 'N', note_type: 'reading', context_item_id: null, tag_ids: [] })
  await assert.rejects(repo.update(note.id, note.revision, { ...note.metadata, note_type: 'permanent' }), /note_type/)
  assert.equal(repo.views().length, 2)
})

test('vault de exemplo da documentação carrega sem registros inválidos e reproduz OR, progresso 50% e backlink', async () => {
  const examples = join(__dirname, '..', '..', '..', 'docs', 'examples', 'vault')
  const repo = new VaultRepository(examples)
  const report = await repo.load()
  assert.deepEqual(report.invalid, [])
  const { buildIndex, groupItems, itemProgress } = await import('../src/domain/derive.js')
  const index = buildIndex(repo.views())
  assert.equal(index.items.length, 1)
  assert.equal(itemProgress(index, index.items[0]!.metadata), 50)
  assert.ok(index.groups.every((g) => groupItems(index, g.metadata).some((i) => i.id === index.items[0]!.id)), 'item aparece nos dois grupos')
  assert.deepEqual(index.backlinks.get('66666666-6666-4666-8666-666666666666'), ['77777777-7777-4777-8777-777777777777'], 'permanente → origem (D-008)')
  assert.deepEqual(index.backlinks.get('77777777-7777-4777-8777-777777777777'), ['99999999-9999-4999-8999-999999999999'])
  assert.ok(repo.views().every((v) => v.problems.every((p) => p.severity !== 'error')))
})

test('carga: arquivo inválido é diagnosticado e não indexado; temporários e manifestos listados, nunca apagados', async (t) => {
  const repo = await vault(t)
  await mkdir(join(repo.root, 'items'), { recursive: true })
  await writeFile(join(repo.root, 'items', '55555555-5555-4555-8555-555555555555.md'), '---\nid: [quebrado\n---\n')
  await writeFile(join(repo.root, 'items', '.tmp-66666666-6666-4666-8666-666666666666.md'), 'x')
  await writeFile(join(repo.root, 'items', 'LEIA-ME.md'), 'não canônico')
  const report = await repo.load()
  assert.equal(report.invalid.length, 1)
  assert.deepEqual(report.temporaries, ['items/.tmp-66666666-6666-4666-8666-666666666666.md'])
  assert.equal(repo.views().length, 0)
  assert.ok((await readdir(join(repo.root, 'items'))).includes('.tmp-66666666-6666-4666-8666-666666666666.md'))
})
