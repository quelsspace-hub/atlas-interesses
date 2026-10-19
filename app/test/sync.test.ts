import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { AtlasService } from '../src/main/service.js'
import { AUTO_BACKUP_NAME, autoBackupName, folderTrash, syncProvider } from '../src/vault/sync.js'

// V5 (D-031): conflitos recuperáveis pela Lixeira e backup automático.

async function setup(t: TestContext, clock?: () => Date) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-v5-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const vault = join(root, 'vault')
  const trashDir = join(root, 'lixeira')
  await mkdir(vault)
  const service = new AtlasService(join(root, 'app'), 'test', folderTrash(trashDir), clock)
  await service.init()
  await service.activate(vault, true)
  return { root, vault, trashDir, service }
}

test('V5: cópias de conflito de Dropbox, Syncthing, Google Drive e OneDrive são detectadas por UUID', async (t) => {
  const { vault, service } = await setup(t)
  const tag = await service.create('tag', { title: 'UX' }, '')
  const original = await readFile(join(vault, 'tags', `${tag.id}.md`), 'utf8')
  const names = [`${tag.id} (cópia em conflito de PC 2026-10-19).md`, `${tag.id}.sync-conflict-20261019-120000-ABCDEFG.md`, `${tag.id} (1).md`, `${tag.id}-NOTEBOOK.md`]
  for (const n of names) await writeFile(join(vault, 'tags', n), original.replace('title: UX', 'title: UX remoto'))
  await writeFile(join(vault, 'tags', 'LEIA-ME.md'), 'não é conflito')
  const snapshot = await service.load()
  assert.deepEqual(snapshot.conflicts.map((c) => c.path.split('/')[1]).sort(), [...names].sort())
  assert.ok(snapshot.conflicts.every((c) => c.recordId === tag.id && c.recordPath === `tags/${tag.id}.md` && c.kind === 'tag'))
  assert.equal(snapshot.records.length, 1, 'cópias não viram registros duplicados')
})

test('V5: manter a versão atual manda só a cópia para a Lixeira; usar a cópia troca com a atual indo para a Lixeira', async (t) => {
  const { vault, trashDir, service } = await setup(t)
  const tag = await service.create('tag', { title: 'Local' }, '')
  const canonical = join(vault, 'tags', `${tag.id}.md`)
  const local = await readFile(canonical, 'utf8')
  const remote = local.replace('title: Local', 'title: Remoto')
  const copyA = `tags/${tag.id} (1).md`
  await writeFile(join(vault, ...copyA.split('/')), remote)
  await service.load()
  const view = await service.conflict(copyA)
  assert.equal(view.currentText, local)
  assert.equal(view.copyText, remote)
  assert.deepEqual(view.copyProblems, [])
  await service.resolveConflict(copyA, 'keep-current', view.currentRevision)
  assert.equal(await readFile(canonical, 'utf8'), local)
  assert.deepEqual((await service.load()).conflicts, [])
  const trashed = await readdir(trashDir)
  assert.equal(trashed.length, 1)
  assert.equal(await readFile(join(trashDir, trashed[0]!), 'utf8'), remote, 'cópia recuperável na Lixeira')

  const copyB = `tags/${tag.id}.sync-conflict-20261019-120000-ABCDEFG.md`
  await writeFile(join(vault, ...copyB.split('/')), remote)
  await service.load()
  const viewB = await service.conflict(copyB)
  await service.resolveConflict(copyB, 'use-copy', viewB.currentRevision)
  assert.equal(await readFile(canonical, 'utf8'), remote)
  const after = await service.load()
  assert.deepEqual(after.conflicts, [])
  assert.equal((after.records[0]!.metadata as { title: string }).title, 'Remoto')
  const trashedB = await readdir(trashDir)
  assert.equal(trashedB.length, 2)
  assert.ok((await Promise.all(trashedB.map((n) => readFile(join(trashDir, n), 'utf8')))).includes(local), 'versão anterior recuperável na Lixeira')
})

test('V5: usar a cópia é recusado se a versão atual mudou desde a comparação ou se a cópia é inválida', async (t) => {
  const { vault, trashDir, service } = await setup(t)
  const tag = await service.create('tag', { title: 'Local' }, '')
  const canonical = join(vault, 'tags', `${tag.id}.md`)
  const copy = `tags/${tag.id} (1).md`
  await writeFile(join(vault, ...copy.split('/')), (await readFile(canonical, 'utf8')).replace('Local', 'Remoto'))
  await service.load()
  const view = await service.conflict(copy)
  const changed = (await readFile(canonical, 'utf8')).replace('Local', 'Editado agora')
  await writeFile(canonical, changed)
  await assert.rejects(service.resolveConflict(copy, 'use-copy', view.currentRevision), /mudou desde que foi exibida/)
  assert.equal(await readFile(canonical, 'utf8'), changed, 'nada trocado')
  const bad = `tags/${tag.id} (2).md`
  await writeFile(join(vault, ...bad.split('/')), '---\nid: [quebrado\n---\n')
  await service.load()
  const badView = await service.conflict(bad)
  assert.ok(badView.copyProblems.length > 0)
  await assert.rejects(service.resolveConflict(bad, 'use-copy', badView.currentRevision), /não é um registro válido/)
  assert.deepEqual(await readdir(trashDir).catch(() => []), [])
})

test('V5: backup automático verificado, a cada 24 h, com rotação só dos próprios arquivos e pela Lixeira', async (t) => {
  let now = new Date('2026-10-19T10:00:00')
  const { root, vault, trashDir, service } = await setup(t, () => now)
  await service.create('tag', { title: 'UX' }, '')
  const folder = join(root, 'backups')
  await mkdir(folder)
  await writeFile(join(folder, 'meu-arquivo.zip'), 'não é do Atlas')
  await assert.rejects(service.setAutoBackup({ folder: join(vault, 'assets') }), /fora do vault/)
  await service.setAutoBackup({ folder, enabled: true, keep: 2 })
  assert.equal(service.autoBackupDue(), true)
  const s1 = await service.runAutoBackup()
  assert.equal(s1.autoBackup.last?.ok, true, s1.autoBackup.last?.message)
  assert.equal(service.autoBackupDue(), false, 'não repete antes de 24 h')
  now = new Date('2026-10-19T20:00:00')
  assert.equal(service.autoBackupDue(), false)
  for (const d of ['2026-10-20T10:00:01', '2026-10-21T10:00:02', '2026-10-22T10:00:03']) {
    now = new Date(d)
    assert.equal(service.autoBackupDue(), true)
    assert.equal((await service.runAutoBackup()).autoBackup.last?.ok, true)
  }
  const kept = (await readdir(folder)).filter((n) => AUTO_BACKUP_NAME.test(n)).sort()
  assert.deepEqual(kept, [autoBackupName(new Date('2026-10-21T10:00:02')), autoBackupName(new Date('2026-10-22T10:00:03'))])
  assert.ok((await readdir(folder)).includes('meu-arquivo.zip'), 'arquivo alheio intocado')
  assert.equal((await readdir(trashDir)).length, 2, 'antigos na Lixeira, não apagados')

  // Bloqueio: transação pendente impede o backup; nada publicado e falha registrada.
  await writeFile(join(vault, 'inbox', '.txn_11111111-1111-4111-8111-111111111111.json'), '{}')
  now = new Date('2026-10-24T10:00:00')
  const failed = await service.runAutoBackup()
  assert.equal(failed.autoBackup.last?.ok, false)
  assert.match(failed.autoBackup.last!.message, /bloqueado/)
  assert.equal((await readdir(folder)).filter((n) => AUTO_BACKUP_NAME.test(n)).length, 2)
  assert.equal(service.autoBackupDue(), true, 'continua devido até um sucesso')
})

test('V5: indicação informativa do provedor pelo caminho', () => {
  assert.equal(syncProvider('C:\\Users\\a\\OneDrive\\Atlas', {}), 'OneDrive')
  assert.equal(syncProvider('C:\\Users\\a\\OneDrive - Empresa\\Atlas', {}), 'OneDrive')
  assert.equal(syncProvider('D:\\Nuvem\\Atlas', { OneDrive: 'D:\\Nuvem' }), 'OneDrive')
  assert.equal(syncProvider('C:\\Users\\a\\Dropbox\\Atlas', {}), 'Dropbox')
  assert.equal(syncProvider('G:\\Meu Drive\\Atlas', {}), 'Google Drive')
  assert.equal(syncProvider('C:\\Users\\a\\Documents\\Atlas', {}), null)
})
