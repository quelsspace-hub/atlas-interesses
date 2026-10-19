import { TextDecoder } from 'node:util'
import { isMap, LineCounter, parseDocument, stringify } from 'yaml'
import { FrontmatterDiagnosticError, RecordValidationError } from './errors.js'
import { isUuidV4 } from './identity.js'

export interface RecordMetadata {
  id: string
  title: string
  sort_order?: number
  [key: string]: unknown
}

export interface ReducedEnvelopeMetadata extends RecordMetadata {
  sort_order: number
}

export interface RecordParts {
  metadata: RecordMetadata
  body: Buffer
}

const utf8 = new TextDecoder('utf-8', { fatal: true })
const openingLf = Buffer.from('---\n', 'ascii')
const openingCrLf = Buffer.from('---\r\n', 'ascii')
const closingMarker = Buffer.from('---', 'ascii')

function findOpeningEnd(bytes: Buffer): number {
  if (bytes.subarray(0, openingLf.length).equals(openingLf)) return openingLf.length
  if (bytes.subarray(0, openingCrLf.length).equals(openingCrLf)) return openingCrLf.length
  throw new FrontmatterDiagnosticError(['Frontmatter must start with --- on the first line'])
}

function findClosingLine(bytes: Buffer, openingEnd: number): { start: number; bodyStart: number } {
  for (let start = openingEnd; start <= bytes.length - closingMarker.length; start += 1) {
    if (bytes[start - 1] !== 0x0a || !bytes.subarray(start, start + 3).equals(closingMarker)) continue

    const afterMarker = start + closingMarker.length
    if (afterMarker === bytes.length) return { start, bodyStart: afterMarker }
    if (bytes[afterMarker] === 0x0a) return { start, bodyStart: afterMarker + 1 }
    if (bytes[afterMarker] === 0x0d && bytes[afterMarker + 1] === 0x0a) {
      return { start, bodyStart: afterMarker + 2 }
    }
  }

  throw new FrontmatterDiagnosticError(['Closing --- delimiter was not found'])
}

export function validateMetadata(value: unknown): RecordMetadata {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RecordValidationError('Experimental envelope must be a YAML mapping')
  }

  const metadata = value as Record<string, unknown>
  if (!isUuidV4(metadata.id)) {
    throw new RecordValidationError('id must be a UUID v4 string')
  }
  if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
    throw new RecordValidationError('title must be a non-empty string')
  }
  return metadata as RecordMetadata
}

export function validateReducedEnvelope(value: unknown): ReducedEnvelopeMetadata {
  const metadata = validateMetadata(value)
  if (typeof metadata.sort_order !== 'number' || !Number.isInteger(metadata.sort_order)) {
    throw new RecordValidationError('sort_order must be an integer in this experimental envelope')
  }

  return metadata as ReducedEnvelopeMetadata
}

export interface RawRecordParts {
  metadata: Record<string, unknown>
  body: Buffer
}

export function parseRecordBytes(bytes: Buffer): RecordParts {
  const parts = parseFrontmatterDocument(bytes)
  return { metadata: validateMetadata(parts.metadata), body: parts.body }
}

// Lê e valida apenas a sintaxe do frontmatter; a validação de campos fica com quem chama.
export function parseFrontmatterDocument(bytes: Buffer): RawRecordParts {
  const openingEnd = findOpeningEnd(bytes)
  const closing = findClosingLine(bytes, openingEnd)
  let yamlText: string

  try {
    yamlText = utf8.decode(bytes.subarray(openingEnd, closing.start))
  } catch (error) {
    throw new FrontmatterDiagnosticError([`Frontmatter is not valid UTF-8: ${String(error)}`])
  }

  const lineCounter = new LineCounter()
  const document = parseDocument(yamlText, {
    lineCounter,
    logLevel: 'error',
    strict: true,
    uniqueKeys: true
  })
  const diagnostics = [...document.errors, ...document.warnings].map((issue) => {
    const location = issue.pos ? lineCounter.linePos(issue.pos[0]) : undefined
    const prefix = location ? `line ${location.line}, column ${location.col}: ` : ''
    return `${prefix}${issue.code}: ${issue.message}`
  })

  if (diagnostics.length > 0) throw new FrontmatterDiagnosticError(diagnostics)
  if (!isMap(document.contents)) {
    throw new FrontmatterDiagnosticError(['Frontmatter root must be a mapping'])
  }

  return {
    metadata: document.toJS({ maxAliasCount: 10 }) as Record<string, unknown>,
    body: Buffer.from(bytes.subarray(closing.bodyStart))
  }
}

export function encodeRecordBytes(metadata: RecordMetadata, body: Buffer): Buffer {
  const validMetadata = validateMetadata(metadata)
  const yaml = stringify(validMetadata)
  const header = Buffer.from(`---\n${yaml}---\n`, 'utf8')
  return Buffer.concat([header, body])
}