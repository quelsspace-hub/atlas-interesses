import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { AtlasService, fail } from '../src/main/service.js'

// Fluxo F-07 pelo serviço usado pelo IPC: exportar, pré-visualizar, restaurar em pasta nova e abrir a cópia.
test('serviço: vault criado, exportado, restaurado em pasta nova e reaberto com os mesmos registros', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-service-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const appData = join(root, 'app-data')
  const vault = join(root, 'Meu vault')
  await mkdir(vault)
  const service = new AtlasService(appData, '0.1.0-test')
  await service.init()
  await service.activate(vault, true)
  const tag = await service.create('tag', { title: 'UX' }, '')
  const item = await service.create('item', { title: 'Projeto', type: 'project', status: 'active', tag_ids: [tag.id], progress_mode: 'tasks', manual_progress: null }, '# Corpo\r\n')
  await service.create('task', { title: 'T', status: 'todo', project_id: item.id, is_next_action: true, sort_order: 0, completed_at: null }, '')
  await writeFile(join(vault, 'assets', 'foto.bin'), Buffer.from([1, 2, 3]))

  const preview = await service.previewExport()
  assert.equal(preview.blockers.length, 0)
  assert.equal(preview.canonicalCount, 4)
  const archive = join(root, 'backup.zip')
  const exported = await service.runExport(archive, { nonCanonical: {}, systemFiles: 'exclude' })
  assert.equal(exported.fileCount, 4)

  const restorePreview = await service.previewRestore(archive)
  assert.equal(restorePreview.fileCount, 4)
  assert.deepEqual(restorePreview.byFolder, { assets: 1, items: 1, tags: 1, tasks: 1 })
  // A pasta-pai não pode conter o vault ativo nem estar dentro dele (A-03/A-04).
  const overlapping = await service.runRestore(archive, root, 'Restaurado')
  assert.equal(overlapping.state, 'failed')
  const restores = join(root, 'restores')
  await mkdir(restores)
  const outcome = await service.runRestore(archive, restores, 'Restaurado')
  assert.equal(outcome.state, 'verified', outcome.messages.join('\n'))
  assert.equal(outcome.notice, 'O vault ativo não foi alterado.')
  assert.ok(outcome.canOpen)

  const before = (await service.load()).records.map((r) => [r.id, r.revision]).sort()
  await service.activate(outcome.destination!, false)
  const restored = await service.load()
  assert.deepEqual(restored.records.map((r) => [r.id, r.revision]).sort(), before, 'mesmos bytes (revisões SHA-256) por registro')
  assert.deepEqual(await readFile(join(outcome.destination!, 'assets', 'foto.bin')), Buffer.from([1, 2, 3]))

  // Preferências do dispositivo ficam fora do vault (D-014).
  const settings = JSON.parse(await readFile(join(appData, 'device-settings.json'), 'utf8')) as { vaultPath: string; recentVaults: string[] }
  assert.equal(settings.vaultPath, outcome.destination)
  assert.equal(settings.recentVaults.length, 2)
  assert.ok(!(await readdir(vault)).includes('device-settings.json'))

  // Restaurar de novo no mesmo nome não sobrescreve.
  const again = await service.runRestore(archive, restores, 'Restaurado')
  assert.equal(again.state, 'failed')
})

test('serviço: pasta com conteúdo que não parece vault é recusada; transação pendente bloqueia a exportação', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-service-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const service = new AtlasService(join(root, 'app'), 'test')
  await service.init()
  const other = join(root, 'documentos')
  await mkdir(other)
  await writeFile(join(other, 'relatorio.docx'), 'x')
  await assert.rejects(service.activate(other, false), /não parece um vault/)
  assert.deepEqual(await readdir(other), ['relatorio.docx'], 'nada criado na pasta recusada')

  const vault = join(root, 'v')
  await mkdir(vault)
  await service.activate(vault, false)
  await writeFile(join(vault, 'inbox', '.txn_11111111-1111-4111-8111-111111111111.json'), '{}')
  const preview = await service.previewExport()
  assert.ok(preview.blockers.length > 0)
  const result = fail(await service.runExport(join(root, 'b.zip'), { nonCanonical: {}, systemFiles: 'exclude' }).catch((e: unknown) => e))
  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.error.code, 'blocked')
})
