export type BackupDiagnosticCategory =
  | 'integrity'
  | 'structure'
  | 'unsupported-version'
  | 'security'
  | 'capacity'
  | 'pending-transaction'
  | 'concurrent-change'
  | 'destination'
  | 'io'

export interface BackupDiagnostic {
  category: BackupDiagnosticCategory
  path: string
  code: string
  message: string
}

export class BackupBlockedError extends Error {
  constructor(readonly diagnostics: readonly BackupDiagnostic[]) {
    super(`Backup blocked: ${diagnostics.map((entry) => `${entry.code} (${entry.path})`).join('; ')}`)
    this.name = 'BackupBlockedError'
  }
}

export class BackupCancelledError extends Error {
  constructor() {
    super('Backup cancelled by the person before any file was written')
    this.name = 'BackupCancelledError'
  }
}

export class BackupDecisionError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Missing explicit inventory decision: ${missing.join(', ')}`)
    this.name = 'BackupDecisionError'
  }
}

export class BackupConcurrentChangeError extends Error {
  constructor(
    readonly diagnostics: readonly BackupDiagnostic[],
    readonly temporaryRemoved: boolean,
    readonly cleanupError?: unknown
  ) {
    super(`Vault changed during export: ${diagnostics.map((entry) => entry.path).join(', ')}`)
    this.name = 'BackupConcurrentChangeError'
  }
}

export class BackupVerificationError extends Error {
  constructor(
    readonly diagnostics: readonly BackupDiagnostic[],
    readonly temporaryRemoved?: boolean,
    readonly cleanupError?: unknown
  ) {
    super(`Backup archive failed verification: ${diagnostics.map((entry) => `${entry.code} (${entry.path})`).join('; ')}`)
    this.name = 'BackupVerificationError'
  }
}

export class BackupWriteError extends Error {
  constructor(
    readonly stage: string,
    cause: unknown,
    readonly temporaryPath?: string,
    readonly temporaryRemoved?: boolean,
    readonly cleanupError?: unknown
  ) {
    super(`Backup write failed (${stage})`, { cause })
    this.name = 'BackupWriteError'
  }
}

export class BackupDestinationError extends Error {
  constructor(readonly path: string, message: string) {
    super(message)
    this.name = 'BackupDestinationError'
  }
}
