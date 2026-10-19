// Jornadas de referência (UX §3) no aplicativo Electron real, com conferência dos arquivos no disco.
// Uso: npm run build && node e2e/journeys.mjs [pasta-de-screenshots]
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { launch, tempDir } from './launch.mjs'

const shots = process.argv[2]
const vault = await tempDir('atlas-e2e-vault-')
const userData = await tempDir('atlas-e2e-data-')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const files = async (folder) => (await readdir(join(vault, ...folder.split('/')))).filter((n) => /^[0-9a-f-]{36}\.md$/.test(n))
const read = (folder, name) => readFile(join(vault, ...folder.split('/'), name), 'utf8')
const steps = []
const step = (name) => { steps.push(name); console.log(`• ${name}`) }
let session = await launch({ vault, userData })
let { page } = session
const shot = async (name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }) }
const nav = (label) => page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: label, exact: false }).first().click()
const toast = (text) => page.getByRole('status').getByText(text, { exact: false }).first().waitFor({ timeout: 10000 })

try {
  await page.getByRole('heading', { name: 'ATLAS DE INTERESSES' }).waitFor({ timeout: 20000 })

  step('captura rápida grava na Inbox')
  await page.locator('#quick-capture').fill('Estudar design de serviços')
  await page.getByRole('button', { name: 'Capturar' }).click()
  await toast('Captura salva na Inbox.')
  const captures = await files('inbox')
  assert.equal(captures.length, 1)
  assert.match(await read('inbox', captures[0]), /status: pending[\s\S]*---\n\nEstudar design de serviços\n$/)

  step('Organização: tag UX associada a Design e Tecnologia')
  await nav('Organização')
  await page.getByRole('tab', { name: /Tags/ }).click()
  await page.locator('#new-tag').fill('UX')
  await page.getByRole('button', { name: 'Criar tag' }).click()
  await toast('Tag criada.')
  await page.getByRole('tab', { name: /Grupos/ }).click()
  for (const title of ['Design', 'Tecnologia']) {
    await page.locator('#new-group').fill(title)
    await page.getByRole('button', { name: 'Criar grupo' }).click()
    await page.getByText(title, { exact: true }).waitFor()
  }
  for (const title of ['Design', 'Tecnologia']) {
    await page.locator('.list-row', { hasText: title }).getByRole('button', { name: 'Editar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar grupo' })
    await dialog.getByRole('button', { name: 'UX', exact: true }).click()
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await dialog.getByText('Salvo no disco').waitFor()
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  }
  assert.equal((await files('groups')).length, 2)
  await shot('organizacao')

  step('Atlas: novo projeto com a tag UX, tarefas e progresso')
  await nav('Atlas')
  await page.getByRole('button', { name: /Novo item/ }).click()
  const newItem = page.getByRole('dialog', { name: 'Novo item' })
  await newItem.getByLabel('Título *').fill('Projeto E2E')
  await newItem.getByRole('button', { name: 'UX', exact: true }).click()
  await newItem.getByRole('button', { name: 'Criar' }).click()
  await page.getByLabel('Título *').waitFor()
  for (const t of ['Primeira tarefa', 'Segunda tarefa']) {
    await page.getByLabel('Nova tarefa do projeto').fill(t)
    await page.getByRole('button', { name: 'Adicionar', exact: true }).last().click()
    await page.getByRole('button', { name: t }).waitFor()
  }
  await page.getByLabel('Progresso 0%').first().waitFor()
  await page.getByLabel('Concluir Primeira tarefa').click()
  await page.getByLabel('Reabrir Primeira tarefa').waitFor()
  await page.getByLabel('Progresso 50%').first().waitFor()
  const [itemFile] = await files('items')
  const doneTask = (await Promise.all((await files('tasks')).map((n) => read('tasks', n)))).find((s) => s.includes('Primeira tarefa'))
  assert.match(doneTask, /status: done/)
  assert.match(doneTask, /completed_at: '\d{4}-/)

  step('edição: Ctrl+S grava metadados; corpo só muda por edição explícita (D-006)')
  const bodyBefore = (await read('items', itemFile)).split('\n---\n')[1]
  await page.getByLabel('Resumo').fill('Resumo editado')
  await page.getByText('Alterações não salvas').waitFor()
  await page.keyboard.press('Control+s')
  await page.getByText('Salvo no disco').waitFor()
  const afterMeta = await read('items', itemFile)
  assert.match(afterMeta, /summary: Resumo editado/)
  assert.equal(afterMeta.split('\n---\n')[1], bodyBefore, 'corpo preservado byte a byte')
  await page.locator('#body-editor').fill('# Plano\n\nTexto do plano.\n')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.getByText('Salvo no disco').waitFor()
  assert.ok((await read('items', itemFile)).endsWith('# Plano\n\nTexto do plano.\n'))
  await shot('item')

  step('um item em dois grupos (OR), sem duplicar arquivo')
  await nav('Atlas')
  for (const g of ['Design', 'Tecnologia']) {
    await page.getByRole('button', { name: new RegExp(`^${g}`) }).click()
    await page.getByRole('heading', { name: g }).waitFor()
    await page.getByRole('button', { name: 'Projeto E2E' }).waitFor()
    await page.getByRole('button', { name: '← Atlas' }).click()
  }
  assert.equal((await files('items')).length, 1)
  await shot('atlas')

  step('Inbox: processar captura em nota de leitura (transação recuperável)')
  await nav('Inbox')
  await page.getByRole('button', { name: 'Processar' }).click()
  const proc = page.getByRole('dialog', { name: 'Processar captura' })
  await proc.getByLabel('Resultado principal').selectOption('note')
  await proc.getByLabel('Tipo de nota').selectOption('reading')
  await proc.getByRole('button', { name: 'Confirmar conversão' }).click()
  await page.getByRole('button', { name: 'Criar nota permanente a partir desta' }).waitFor()
  const capture = await read('inbox', captures[0])
  assert.match(capture, /status: processed/)
  assert.match(capture, /converted_to_type: note/)
  assert.ok(capture.endsWith('Estudar design de serviços\n'), 'conteúdo da captura preservado')
  assert.deepEqual((await readdir(join(vault, 'inbox'))).filter((n) => n.startsWith('.txn_')), [])

  step('criar nota permanente a partir da leitura (D-008): origem intacta e backlink')
  const [readingFile] = await files('notes/reading')
  const originHash = sha(await read('notes/reading', readingFile))
  await page.getByRole('button', { name: 'Criar nota permanente a partir desta' }).click()
  const perm = page.getByRole('dialog', { name: 'Criar nota permanente a partir desta' })
  await perm.getByLabel('Título *').fill('Serviços como sistema')
  await perm.getByRole('button', { name: 'Salvar nova nota' }).click()
  await page.getByRole('heading', { name: 'Backlinks' }).waitFor()
  const [permFile] = await files('notes/permanent')
  assert.ok(permFile, 'nota permanente criada')
  assert.match(await read('notes/permanent', permFile), new RegExp(`\\]\\(\\.\\./reading/${readingFile}\\)`))
  assert.equal(sha(await read('notes/reading', readingFile)), originHash, 'nota de origem não foi regravada')
  await page.getByRole('button', { name: 'Estudar design de serviços' }).click()
  await page.locator('aside').getByRole('button', { name: 'Serviços como sistema' }).waitFor()
  await shot('nota')

  step('fechar com alterações pendentes: Cancelar mantém; Descartar fecha')
  await page.locator('#body-editor').fill('rascunho não salvo')
  await page.getByText('Alterações não salvas').waitFor()
  const closeWindow = () => session.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await closeWindow()
  const pending = page.getByRole('dialog', { name: 'Há alterações não salvas' })
  await pending.waitFor()
  await shot('fechar-pendente')
  await pending.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByText('Alterações não salvas').waitFor()
  const closed = new Promise((resolve) => session.app.once('close', resolve))
  await closeWindow()
  await pending.getByRole('button', { name: 'Descartar alterações' }).click()
  await closed
  assert.equal(sha(await read('notes/reading', readingFile)), originHash, 'descartar não gravou nada')

  step('reiniciar: dados persistidos e índices reconstruídos do disco')
  session = await launch({ vault, userData })
  page = session.page
  await page.getByText('Visão geral · 1 itens · 2 notas · 2 grupos').waitFor({ timeout: 20000 })
  await nav('Notas')
  await page.getByRole('button', { name: 'Serviços como sistema' }).click()
  await page.locator('aside').getByRole('button', { name: 'Estudar design de serviços' }).waitFor()
  await nav('Tarefas')
  await page.getByRole('tab', { name: /Concluídas/ }).click()
  await page.getByRole('button', { name: 'Primeira tarefa' }).waitFor()
  assert.deepEqual(session.errors, [], 'sem erros no console do renderer')
  console.log(`OK — ${steps.length} jornadas verificadas`)
} catch (error) {
  await shot('falha').catch(() => {})
  console.error('FALHOU no passo:', steps.at(-1))
  console.error(error)
  console.error('erros do renderer:', JSON.stringify(session.errors))
  process.exitCode = 1
} finally {
  await session.app.close().catch(() => {})
  await rm(vault, { recursive: true, force: true })
  await rm(userData, { recursive: true, force: true })
}
