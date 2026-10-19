import type { RecordView } from '../domain/derive.js'
import type { EntityKind } from '../domain/model.js'
import type { Problem } from '../domain/validate.js'

// Contrato IPC entre o renderer e o processo principal. O renderer nunca acessa o disco.

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

export interface ApiError {
  code: 'conflict' | 'exists' | 'invalid' | 'not-found' | 'storage' | 'uncertain' | 'no-vault' | 'cancelled' | 'blocked' | 'failed'
  message: string
  details?: Record<string, unknown>
}

export type ThemePreference = 'system' | 'light' | 'dark'

export interface AutoBackupSettings {
  enabled: boolean
  folder: string | null
  keep: number
  lastSuccessAt: string | null
  last: { at: string; ok: boolean; message: string; file: string | null } | null
}

export interface AppState {
  vaultPath: string | null
  recentVaults: string[]
  theme: ThemePreference
  version: string
  autoBackup: AutoBackupSettings
  // Provedor de sincronização detectado pelo caminho do vault (informativo, D-031).
  syncProvider: string | null
}

export interface ConflictCopyInfo {
  path: string
  recordId: string
  recordPath: string
  kind: EntityKind
}

export interface ConflictDetail extends ConflictCopyInfo {
  copyText: string
  copyProblems: string[]
  currentText: string | null
  currentRevision: string | null
}

export interface VaultSnapshot {
  path: string
  records: RecordView[]
  invalid: Array<{ path: string; problems: Problem[] }>
  temporaries: string[]
  transactions: string[]
  recovery: Array<{ manifest: string; captureId: string; outcome: 'completed' | 'discarded' | 'blocked'; message: string }>
  schemaVersions: number[]
  conflicts: ConflictCopyInfo[]
}

export interface ConversionOutput {
  kind: 'item' | 'task' | 'note'
  input: Record<string, unknown>
  body: string
}

export interface ExportPreview {
  canonicalCount: number
  totalBytes: number
  nonCanonical: string[]
  systemFiles: string[]
  blockers: Array<{ path: string; message: string }>
}

export interface ExportOutcome {
  archivePath: string
  fileCount: number
  sha256: string
}

export interface RestorePreview {
  archivePath: string
  createdAt: string
  manifestVersion: number
  fileCount: number
  totalBytes: number
  byFolder: Record<string, number>
}

export interface RestoreOutcome {
  state: 'verified' | 'verified-with-warnings' | 'failed' | 'interrupted'
  destination: string | null
  canOpen: boolean
  counts: { expected: number; extracted: number; verified: number }
  messages: string[]
  notice: string
}

export interface AtlasApi {
  getState(): Promise<Result<AppState>>
  chooseVault(mode: 'open' | 'create'): Promise<Result<AppState>>
  openRecent(path: string): Promise<Result<AppState>>
  closeVault(): Promise<Result<AppState>>
  setTheme(theme: ThemePreference): Promise<Result<AppState>>

  loadVault(): Promise<Result<VaultSnapshot>>
  createRecord(kind: EntityKind, metadata: Record<string, unknown>, body: string): Promise<Result<RecordView>>
  updateRecord(id: string, revision: string, metadata: Record<string, unknown>, body?: string): Promise<Result<RecordView>>
  refreshRecord(id: string): Promise<Result<RecordView | null>>
  convertCapture(captureId: string, revision: string, outputs: ConversionOutput[]): Promise<Result<{ primaryId: string; ids: string[] }>>
  addAttachment(fromRecordPath: string): Promise<Result<{ markdown: string } | null>>

  previewExport(): Promise<Result<ExportPreview>>
  runExport(decisions: { nonCanonical: Record<string, 'include' | 'exclude'>; systemFiles: 'include' | 'exclude' }): Promise<Result<ExportOutcome | null>>
  chooseRestoreArchive(): Promise<Result<RestorePreview | null>>
  chooseRestoreParent(): Promise<Result<string | null>>
  runRestore(archivePath: string, parentDirectory: string, folderName: string): Promise<Result<RestoreOutcome>>
  openRestoredVault(path: string): Promise<Result<AppState>>

  getConflict(path: string): Promise<Result<ConflictDetail>>
  resolveConflict(path: string, choice: 'keep-current' | 'use-copy', expectedCurrentRevision: string | null): Promise<Result<null>>
  chooseAutoBackupFolder(): Promise<Result<AppState>>
  setAutoBackup(patch: { enabled?: boolean; keep?: number }): Promise<Result<AppState>>
  runAutoBackupNow(): Promise<Result<AppState>>
  onVaultChanged(handler: () => void): () => void
  onStateChanged(handler: (state: AppState) => void): () => void

  revealPath(path: string): Promise<Result<null>>
  openExternal(url: string): Promise<Result<null>>
  confirmClose(): Promise<void>
  onCloseRequested(handler: () => void): () => void
}

declare global {
  interface Window {
    atlas: AtlasApi
  }
}
