import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { AtlasService, fail, ok } from './service.js'
import type { EntityKind } from '../domain/model.js'
import type { ConversionOutput, Result, ThemePreference } from '../shared/api.js'

// Processo principal (D-017). O renderer roda isolado (contextIsolation + sandbox) e só fala por IPC.
let window: BrowserWindow | null = null
let allowClose = false
const service = new AtlasService(app.getPath('userData'), app.getVersion())

function applyTheme(theme: ThemePreference): void {
  nativeTheme.themeSource = theme
}

function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => Promise<T> | T): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<Result<T>> => {
    if (!window || event.sender !== window.webContents) return { ok: false, error: { code: 'invalid', message: 'origem IPC não autorizada' } }
    try {
      return ok(await fn(...(args as A)))
    } catch (error) {
      return fail(error)
    }
  })
}

function registerIpc(): void {
  handle('state:get', () => service.state())
  handle('vault:choose', async (mode: 'open' | 'create') => {
    const result = await dialog.showOpenDialog(window!, {
      title: mode === 'create' ? 'Escolha uma pasta vazia para o novo vault' : 'Abrir vault do Atlas',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return service.state()
    return service.activate(result.filePaths[0]!, mode === 'create')
  })
  handle('vault:recent', (path: string) => service.activate(path, false))
  handle('vault:close', () => service.closeVault())
  handle('theme:set', async (theme: ThemePreference) => {
    const state = await service.setTheme(theme)
    applyTheme(theme)
    return state
  })
  handle('vault:load', () => service.load())
  handle('record:create', (kind: EntityKind, metadata: Record<string, unknown>, body: string) => service.create(kind, metadata, body))
  handle('record:update', (id: string, revision: string, metadata: Record<string, unknown>, body?: string) => service.update(id, revision, metadata, body))
  handle('record:refresh', (id: string) => service.refresh(id))
  handle('capture:convert', (id: string, revision: string, outputs: ConversionOutput[]) => service.convert(id, revision, outputs))
  handle('attachment:add', async (fromRecordPath: string) => {
    const result = await dialog.showOpenDialog(window!, { title: 'Anexar arquivo', properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return service.addAttachment(fromRecordPath, result.filePaths[0]!)
  })
  handle('backup:preview-export', () => service.previewExport())
  handle('backup:run-export', async (decisions: { nonCanonical: Record<string, 'include' | 'exclude'>; systemFiles: 'include' | 'exclude' }) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const result = await dialog.showSaveDialog(window!, {
      title: 'Salvar backup do vault',
      defaultPath: join(app.getPath('documents'), `atlas-backup-${stamp}.zip`),
      filters: [{ name: 'Backup ZIP', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return null
    return service.runExport(result.filePath, decisions)
  })
  handle('backup:choose-archive', async () => {
    const result = await dialog.showOpenDialog(window!, { title: 'Escolher backup', properties: ['openFile'], filters: [{ name: 'Backup ZIP', extensions: ['zip'] }] })
    if (result.canceled || result.filePaths.length === 0) return null
    return service.previewRestore(result.filePaths[0]!)
  })
  handle('backup:choose-parent', async () => {
    const result = await dialog.showOpenDialog(window!, { title: 'Pasta onde a cópia restaurada será criada', properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]!
  })
  handle('backup:run-restore', (archivePath: string, parent: string, folderName: string) => service.runRestore(archivePath, parent, folderName))
  handle('backup:open-restored', (path: string) => service.activate(path, false))
  handle('shell:reveal', (path: string) => {
    shell.showItemInFolder(path)
    return null
  })
  handle('shell:external', async (url: string) => {
    // Só http(s) e mailto; nunca protocolos executáveis (VAULT_CONTRACT §5).
    if (!/^(https?:|mailto:)/i.test(url)) throw new Error('Só links http, https e mailto são abertos externamente.')
    await shell.openExternal(url)
    return null
  })
  ipcMain.handle('app:confirm-close', (event) => {
    if (!window || event.sender !== window.webContents) return
    allowClose = true
    window.close()
  })
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    title: 'Atlas de Interesses',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#010117' : '#F9F8F2',
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })
  window.once('ready-to-show', () => window?.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  // D-025: ao fechar, o renderer decide (Salvar, Descartar ou Cancelar) se houver alterações pendentes.
  window.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    window?.webContents.send('app:close-requested')
  })
  window.on('closed', () => { window = null })
  void window.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()
else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.focus() }
  })
  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    await service.init()
    applyTheme(service.state().theme)
    registerIpc()
    createWindow()
  })
  app.on('window-all-closed', () => app.quit())
}
