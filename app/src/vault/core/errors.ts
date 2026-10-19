export class FrontmatterDiagnosticError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(`Invalid YAML Frontmatter: ${diagnostics.join('; ')}`)
    this.name = 'FrontmatterDiagnosticError'
  }
}

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordValidationError'
  }
}

export class DestinationExistsError extends Error {
  constructor(readonly path: string) {
    super(`Destination already exists: ${path}`)
    this.name = 'DestinationExistsError'
  }
}

export class TemporaryWriteError extends Error {
  constructor(
    readonly path: string,
    cause: unknown,
    readonly cleanupError?: unknown
  ) {
    super(`Temporary write failed: ${path}`, { cause })
    this.name = 'TemporaryWriteError'
  }
}

export class WriteConflictError extends Error {
  constructor(
    readonly path: string,
    readonly baseRevision: string,
    readonly externalBytes: Buffer,
    readonly draftBytes: Buffer,
    readonly tempPath?: string,
    readonly cleanupError?: unknown
  ) {
    super(`File changed outside this operation: ${path}`)
    this.name = 'WriteConflictError'
  }
}

export class StorageFailureError extends Error {
  constructor(
    readonly operation: string,
    readonly path: string,
    readonly draftBytes: Buffer,
    cause: unknown,
    readonly tempPath?: string,
    readonly cleanupError?: unknown
  ) {
    super(`Storage operation failed (${operation}): ${path}`, { cause })
    this.name = 'StorageFailureError'
  }
}

export class UncertainWriteError extends Error {
  constructor(
    readonly path: string,
    readonly expectedRevision: string,
    readonly draftBytes: Buffer,
    cause: unknown,
    readonly observedBytes?: Buffer,
    readonly tempPath?: string
  ) {
    super(`Write outcome could not be confirmed: ${path}`, { cause })
    this.name = 'UncertainWriteError'
  }
}