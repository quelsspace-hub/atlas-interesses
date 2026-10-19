import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { InboxTransactions, PRIMARY, type OutputSpec } from '../src/vault/inbox.js'
import { VaultRepository } from '../src/vault/repository.js'

// F-05 / D-002 / D-021 / D-023: conversão recuperável; interromper em cada etapa e retomar sem duplicar.

class Crash extends Error {}

async function setup(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-inbox-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repo = new VaultRepository(root)
  await repo.ensureStructure()
  await repo.load()
  const capture = await repo.create('capture', { title: null, capture_kind: 'project', status: 'pending', processed_at: null, archived_at: null, converted_to_type: null, converted_to_id: null }, 'Criar um projeto e duas tarefas.\n')
  return { root, repo, capture }
}

const outputs = (): OutputSpec[] => [
  { kind: 'item', input: { title: 'Projeto da captura', type: 'project', status: 'backlog', tag_ids: [], progress_mode: 'tasks', manual_progress: null }, body: 'Corpo do projeto.\n' },
  { kind: 'task', input: { title: 'Tarefa 1', status: 'todo', project_id: PRIMARY, is_next_action: true, sort_order: 0, completed_at: null }, body: '' },
  { kind: 'task', input: { title: 'Tarefa 2', status: 'todo', project_id: PRIMARY, is_next_action: false, sort_order: 1, completed_at: null }, body: '' }
]

async function tree(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const full = join(entry.parentPath, entry.name)
    result.set(full.slice(root.length + 1).replace(/\\/g, '/'), createHash('sha256').update(await readFile(full)).digest('hex'))
  }
  return result
}

async function assertConverted(repo: VaultRepository, captureId: string, captureBody: Buffer) {
  await repo.load()
  const views = repo.views()
  const capture = views.find((v) => v.id === captureId)!
  const meta = capture.metadata as Record<string, unknown>
  assert.equal(meta.status, 'processed')
  assert.equal(meta.converted_to_type, 'project')
  assert.ok(meta.processed_at)
  const project = views.find((v) => v.kind === 'item')!
  assert.equal(meta.converted_to_id, project.id)
  assert.equal((project.metadata as Record<string, unknown>).origin_capture_id, captureId)
  const tasks = views.filter((v) => v.kind === 'task')
  assert.equal(tasks.length, 2, 'sem duplicatas')
  assert.ok(tasks.every((x) => (x.metadata as Record<string, unknown>).project_id === project.id && (x.metadata as Record<string, unknown>).origin_capture_id === captureId))
  assert.equal(views.filter((v) => v.kind === 'item').length, 1)
  const body = await readFile(join(repo.root, 'inbox', `${captureId}.md`))
  assert.ok(body.toString('utf8').endsWith(captureBody.toString('utf8')), 'captura preserva o conteúdo original')
  const leftovers = [...(await tree(repo.root)).keys()].filter((p) => p.includes('.tmp-') || p.includes('.txn_'))
  assert.deepEqual(leftovers, [])
}

test('conversão completa: projeto + tarefas derivadas, captura processada, nada reconvertido', async (t) => {
  const { repo, capture } = await setup(t)
  const inbox = new InboxTransactions(repo)
  const result = await inbox.convert(capture.id, capture.revision, outputs())
  assert.equal(result.ids.length, 3)
  await assertConverted(repo, capture.id, Buffer.from('Criar um projeto e duas tarefas.\n'))
  const again = repo.views().find((v) => v.id === capture.id)!
  await assert.rejects(inbox.convert(capture.id, again.revision, outputs()), /pendentes/)
})

const steps = ['INIT', 'TMP:0', 'TMP:1', 'TMP:2', 'TMP_WRITTEN', 'RENAMED:0', 'RENAMED:1', 'RENAMED:2', 'FILES_RENAMED', 'CAPTURE_UPDATED', 'INBOX_UPDATED']

for (const step of steps) {
  test(`interrupção após ${step}: recuperação conclui ou descarta sem duplicar; segunda recuperação não altera nada`, async (t) => {
    const { repo, capture } = await setup(t)
    const inbox = new InboxTransactions(repo)
    const seen: string[] = []
    await assert.rejects(inbox.convert(capture.id, capture.revision, outputs(), {
      after: (name) => {
        const indexed = name.replace(/:(.+)$/, () => `:${seen.filter((s) => s.startsWith(name.split(':')[0]!)).length}`)
        seen.push(name)
        if (indexed === step) throw new Crash(step)
      }
    }), Crash)

    // Reinício: novo repositório e nova recuperação a partir do disco.
    const reopened = new VaultRepository(repo.root)
    const report = await reopened.load()
    assert.equal(report.transactions.length, 1, 'manifesto pendente detectado no arranque')
    const recovery = new InboxTransactions(reopened)
    const [first] = await recovery.recoverAll(report.transactions)
    // Sem todos os temporários nem destinos promovidos, a conversão é descartada (D-023); com todos os
    // temporários íntegros, mesmo antes de registrar TMP_WRITTEN, ela é concluída.
    const earlyCrash = step === 'INIT' || step === 'TMP:0' || step === 'TMP:1'
    assert.equal(first!.outcome, earlyCrash ? 'discarded' : 'completed', first!.message)

    if (earlyCrash) {
      await reopened.load()
      const c = reopened.views().find((v) => v.id === capture.id)!
      assert.equal((c.metadata as Record<string, unknown>).status, 'pending', 'captura continua pendente')
      assert.equal(reopened.views().length, 1, 'nenhum resultado parcial')
      const leftovers = [...(await tree(repo.root)).keys()].filter((p) => p.includes('.tmp-') || p.includes('.txn_'))
      assert.deepEqual(leftovers, [])
      // Pode converter de novo depois do descarte.
      await recovery.convert(capture.id, c.revision, outputs())
    }
    await assertConverted(reopened, capture.id, Buffer.from('Criar um projeto e duas tarefas.\n'))

    const before = await tree(repo.root)
    const second = await new InboxTransactions(reopened).recoverAll((await reopened.load()).transactions)
    assert.deepEqual(second, [])
    assert.deepEqual(await tree(repo.root), before, 'segunda reconciliação não altera o estado final')
  })
}

test('destino alheio com o mesmo UUID bloqueia a recuperação sem substituir nada', async (t) => {
  const { repo, capture } = await setup(t)
  const inbox = new InboxTransactions(repo)
  await assert.rejects(inbox.convert(capture.id, capture.revision, outputs(), { after: (n) => { if (n === 'TMP_WRITTEN') throw new Crash(n) } }), Crash)
  const manifest = JSON.parse(await readFile(join(repo.root, 'inbox', `.txn_${capture.id}.json`), 'utf8')) as { outputs: Array<{ file: string }> }
  const target = join(repo.root, ...manifest.outputs[1]!.file.split('/'))
  await writeFile(target, 'conteúdo alheio')
  const reopened = new VaultRepository(repo.root)
  const report = await reopened.load()
  const [result] = await new InboxTransactions(reopened).recoverAll(report.transactions)
  assert.equal(result!.outcome, 'blocked')
  assert.equal(await readFile(target, 'utf8'), 'conteúdo alheio')
  assert.ok((await stat(join(repo.root, 'inbox', `.txn_${capture.id}.json`))).isFile(), 'manifesto mantido para diagnóstico')
  await reopened.load()
  assert.equal((reopened.views().find((v) => v.id === capture.id)!.metadata as Record<string, unknown>).status, 'pending')
})

test('conversão em nota recebe origin_capture_id; captura com conversão pendente bloqueia nova conversão', async (t) => {
  const { repo, capture } = await setup(t)
  const inbox = new InboxTransactions(repo)
  await assert.rejects(inbox.convert(capture.id, capture.revision, [{ kind: 'note', input: { title: 'Nota', note_type: 'reading', context_item_id: null, tag_ids: [] }, body: 'x' }], { after: (n) => { if (n === 'TMP_WRITTEN') throw new Crash(n) } }), Crash)
  await assert.rejects(inbox.convert(capture.id, capture.revision, outputs()), /pendente/)
  const report = await repo.load()
  await inbox.recoverAll(report.transactions)
  await repo.load()
  const note = repo.views().find((v) => v.kind === 'note')!
  assert.equal((note.metadata as Record<string, unknown>).origin_capture_id, capture.id)
  assert.equal((repo.views().find((v) => v.id === capture.id)!.metadata as Record<string, unknown>).converted_to_type, 'note')
})
