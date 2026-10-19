import { contextBridge, ipcRenderer } from 'electron'
import type { AtlasApi } from '../shared/api.js'

// Ponte mínima e tipada: cada método corresponde a um canal IPC tratado no processo principal.
const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: AtlasApi = {
  getState: () => invoke('state:get'),
  chooseVault: (mode) => invoke('vault:choose', mode),
  openRecent: (path) => invoke('vault:recent', path),
  closeVault: () => invoke('vault:close'),
  setTheme: (theme) => invoke('theme:set', theme),
  loadVault: () => invoke('vault:load'),
  createRecord: (kind, metadata, body) => invoke('record:create', kind, metadata, body),
  updateRecord: (id, revision, metadata, body) => invoke('record:update', id, revision, metadata, body),
  refreshRecord: (id) => invoke('record:refresh', id),
  convertCapture: (id, revision, outputs) => invoke('capture:convert', id, revision, outputs),
  addAttachment: (fromRecordPath) => invoke('attachment:add', fromRecordPath),
  previewExport: () => invoke('backup:preview-export'),
  runExport: (decisions) => invoke('backup:run-export', decisions),
  chooseRestoreArchive: () => invoke('backup:choose-archive'),
  chooseRestoreParent: () => invoke('backup:choose-parent'),
  runRestore: (archive, parent, name) => invoke('backup:run-restore', archive, parent, name),
  openRestoredVault: (path) => invoke('backup:open-restored', path),
  getConflict: (path) => invoke('conflict:get', path),
  resolveConflict: (path, choice, revision) => invoke('conflict:resolve', path, choice, revision),
  chooseAutoBackupFolder: () => invoke('autobackup:choose-folder'),
  setAutoBackup: (patch) => invoke('autobackup:set', patch),
  runAutoBackupNow: () => invoke('autobackup:run'),
  onVaultChanged: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('vault:changed', listener)
    return () => ipcRenderer.removeListener('vault:changed', listener)
  },
  onStateChanged: (handler) => {
    const listener = (_: unknown, state: Parameters<typeof handler>[0]) => handler(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  },
  revealPath: (path) => invoke('shell:reveal', path),
  openExternal: (url) => invoke('shell:external', url),
  confirmClose: () => invoke('app:confirm-close'),
  onCloseRequested: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('app:close-requested', listener)
    return () => ipcRenderer.removeListener('app:close-requested', listener)
  }
}

contextBridge.exposeInMainWorld('atlas', api)
