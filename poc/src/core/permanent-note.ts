import { randomUUID } from 'node:crypto'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { noteContextViolation } from './domain-rules.js'
import { RecordValidationError } from './errors.js'
import { encodeRecordBytes, type RecordMetadata } from './frontmatter.js'
import { isUuidV4 } from './identity.js'
import {
  extractMarkdownLinkHrefs,
  rebuildNoteLinkIndex,
  type ExperimentalNoteDirectories
} from './note-link-index.js'
import { createRecord, type RecordSnapshot } from './record.js'
import type { StoragePort } from './storage-port.js'

export interface PermanentNoteRequest {
  sourceNoteId: string
  title: string
  elaboration: string
}

export interface PermanentNoteOptions {
  generateId?: () => string
}

export interface CreatedPermanentNote {
  note: RecordSnapshot
  originHref: string
}

const markdownPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g

export function originLinkText(title: string): string {
  return title.replace(/\r\n|\r|\n/g, ' ').replace(markdownPunctuation, '\\$&')
}

function countHref(source: string, href: string): number {
  return extractMarkdownLinkHrefs(source).filter((candidate) => candidate === href).length
}

function composeBody(elaboration: string, originLine: string): string {
  const eol = elaboration.includes('\r\n') ? '\r\n' : '\n'
  const separator = elaboration.length === 0 ? '' : elaboration.endsWith('\n') ? eol : `${eol}${eol}`
  return `${elaboration}${separator}${originLine}${eol}`
}

export async function createPermanentNoteFrom(
  directories: ExperimentalNoteDirectories,
  request: PermanentNoteRequest,
  storage: StoragePort,
  options: PermanentNoteOptions = {}
): Promise<CreatedPermanentNote> {
  const index = await rebuildNoteLinkIndex(directories, storage)
  const source = index.notesById.get(request.sourceNoteId)
  if (!source) throw new RecordValidationError(`Source note is not indexed: ${request.sourceNoteId}`)
  if (source.noteType === 'permanent') {
    throw new RecordValidationError('A new permanent note is created from a work or reading note')
  }

  const id = (options.generateId ?? randomUUID)()
  if (!isUuidV4(id)) throw new RecordValidationError('Generated id must be a UUID v4')
  if (index.notesById.has(id)) throw new RecordValidationError(`Generated id already identifies a note: ${id}`)

  const metadata: RecordMetadata = { id, title: request.title, note_type: 'permanent', context_item_id: null }
  const violation = noteContextViolation({ note_type: metadata.note_type, context_item_id: metadata.context_item_id })
  if (violation) throw new RecordValidationError(`D-001 violation: ${violation}`)

  const path = join(resolve(directories.notes.permanent), `${id}.md`)
  const originHref = relative(dirname(path), source.path).split(sep).join('/')
  const originLine = `Origem: [${originLinkText(source.title)}](${originHref})`
  const body = composeBody(request.elaboration, originLine)
  if (countHref(body, originHref) !== countHref(request.elaboration, originHref) + 1) {
    throw new RecordValidationError('Origin link would not be parsed as a Markdown link')
  }

  const note = await createRecord(path, encodeRecordBytes(metadata, Buffer.from(body, 'utf8')), storage)
  return { note, originHref }
}
