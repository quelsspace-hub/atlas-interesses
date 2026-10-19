import MarkdownIt from 'markdown-it'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { TextDecoder } from 'node:util'
import { readRecord, saveMetadata, type RecordSnapshot } from './record.js'
import type { StoragePathKind, StoragePort } from './storage-port.js'

export type ExperimentalNoteType = 'work' | 'reading' | 'permanent'

export interface ExperimentalNoteDirectories {
  vaultRoot: string
  notes: Record<ExperimentalNoteType, string>
}

export interface ExperimentalNote {
  id: string
  title: string
  noteType: ExperimentalNoteType
  path: string
}

export interface IndexedNoteLink {
  sourceNoteId: string
  targetNoteId: string
  href: string
  fragment?: string
}

export type NoteLinkDiagnosticCode =
  | 'external-link'
  | 'anchor-only'
  | 'image-excluded'
  | 'non-note-target'
  | 'missing-note'
  | 'outside-vault'
  | 'query-not-supported'
  | 'invalid-target'
  | 'invalid-body-utf8'

export interface NoteLinkDiagnostic {
  sourceNoteId: string
  href: string
  code: NoteLinkDiagnosticCode
  message: string
}

export interface ExperimentalNoteLinkIndex {
  readonly notesById: ReadonlyMap<string, ExperimentalNote>
  readonly outgoingByNoteId: ReadonlyMap<string, readonly IndexedNoteLink[]>
  readonly backlinksByNoteId: ReadonlyMap<string, readonly string[]>
  readonly diagnostics: readonly NoteLinkDiagnostic[]
}

const markdown = new MarkdownIt('commonmark', { html: false, linkify: false })
const bodyDecoder = new TextDecoder('utf-8', { fatal: true })
const noteTypes: readonly ExperimentalNoteType[] = ['work', 'reading', 'permanent']
const uriScheme = /^[a-z][a-z0-9+.-]*:/i
const windowsDrivePath = /^[a-z]:[\\/]/i

function normalizedPath(path: string): string {
  const absolute = resolve(path)
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

function isWithinDirectory(directory: string, path: string): boolean {
  const relativePath = relative(normalizedPath(directory), normalizedPath(path))
  return relativePath === '' || (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

async function pathKindWithoutFollowing(
  root: string,
  path: string,
  storage: StoragePort
): Promise<StoragePathKind> {
  const relativePath = relative(resolve(root), resolve(path))
  if (!relativePath) return storage.pathKind(resolve(root))

  const segments = relativePath.split(sep).filter(Boolean)
  let currentPath = resolve(root)
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = join(currentPath, segments[index])
    const kind = await storage.pathKind(currentPath)
    if (kind === 'symlink') return kind
    if (index < segments.length - 1 && kind !== 'directory') return kind
    if (index === segments.length - 1) return kind
  }
  return 'missing'
}

function diagnostic(
  sourceNoteId: string,
  href: string,
  code: NoteLinkDiagnosticCode,
  message: string
): NoteLinkDiagnostic {
  return { sourceNoteId, href, code, message }
}

function noteTypeFromMetadata(record: RecordSnapshot, directoryType: ExperimentalNoteType): ExperimentalNote {
  if (record.metadata.note_type !== directoryType) {
    throw new Error(`Experimental note fixture path/type mismatch: ${record.path}`)
  }
  if (basename(record.path) !== `${record.metadata.id}.md`) {
    throw new Error(`Experimental note fixture filename/id mismatch: ${record.path}`)
  }

  return {
    id: record.metadata.id,
    title: record.metadata.title,
    noteType: directoryType,
    path: resolve(record.path)
  }
}

async function validateNoteDirectories(
  directories: ExperimentalNoteDirectories,
  storage: StoragePort
): Promise<{ vaultRoot: string; noteRoot: string }> {
  const vaultRoot = resolve(directories.vaultRoot)
  const rootKind = await storage.pathKind(vaultRoot)
  if (rootKind !== 'directory') throw new Error(`Experimental vault root must be a directory: ${vaultRoot}`)

  const noteRoot = join(vaultRoot, 'notes')
  const noteRootKind = await pathKindWithoutFollowing(vaultRoot, noteRoot, storage)
  if (noteRootKind !== 'directory') throw new Error(`Experimental notes root must be a real directory: ${noteRoot}`)

  for (const noteType of noteTypes) {
    const directory = resolve(directories.notes[noteType])
    const canonicalDirectory = resolve(join(noteRoot, noteType))
    if (!isWithinDirectory(noteRoot, directory) || normalizedPath(directory) !== normalizedPath(canonicalDirectory)) {
      throw new Error(`Experimental note directory must be notes/${noteType}: ${directory}`)
    }
    const kind = await pathKindWithoutFollowing(vaultRoot, directory, storage)
    if (kind !== 'directory') {
      throw new Error(`Experimental note directory must be a real directory: ${directory}`)
    }
  }

  return { vaultRoot, noteRoot }
}

async function readNotes(
  directories: ExperimentalNoteDirectories,
  vaultRoot: string,
  storage: StoragePort
): Promise<{ notesById: Map<string, ExperimentalNote>; records: Map<string, RecordSnapshot> }> {
  const notesById = new Map<string, ExperimentalNote>()
  const records = new Map<string, RecordSnapshot>()

  for (const noteType of noteTypes) {
    const directory = resolve(directories.notes[noteType])
    const paths = await storage.listMarkdownFiles(directory)
    for (const path of paths) {
      const absolutePath = resolve(path)
      if (!isWithinDirectory(vaultRoot, absolutePath) || resolve(dirname(absolutePath)) !== directory) {
        throw new Error(`Experimental note listing escaped its directory: ${path}`)
      }
      const kind = await pathKindWithoutFollowing(vaultRoot, absolutePath, storage)
      if (kind !== 'file') throw new Error(`Experimental note entry is not a regular file: ${absolutePath}`)

      const record = await readRecord(absolutePath, storage)
      const note = noteTypeFromMetadata(record, noteType)
      if (notesById.has(note.id)) throw new Error(`Duplicate experimental note UUID: ${note.id}`)
      notesById.set(note.id, note)
      records.set(normalizedPath(note.path), record)
    }
  }

  return { notesById, records }
}

async function classifyLink(
  source: ExperimentalNote,
  href: string,
  vaultRoot: string,
  notesByPath: ReadonlyMap<string, ExperimentalNote>,
  storage: StoragePort
): Promise<{ link?: IndexedNoteLink; diagnostic?: NoteLinkDiagnostic }> {
  if (href.startsWith('#')) {
    return { diagnostic: diagnostic(source.id, href, 'anchor-only', 'Fragment-only links do not target another note') }
  }
  if (windowsDrivePath.test(href)) {
    return { diagnostic: diagnostic(source.id, href, 'outside-vault', 'Absolute filesystem destinations are not followed') }
  }
  if (href.startsWith('//') || uriScheme.test(href)) {
    return { diagnostic: diagnostic(source.id, href, 'external-link', 'External URL is not an inter-note relation') }
  }

  let destination: URL
  try {
    const base = pathToFileURL(`${dirname(source.path)}${sep}`)
    destination = new URL(href, base)
  } catch {
    return { diagnostic: diagnostic(source.id, href, 'invalid-target', 'Markdown destination could not be resolved') }
  }

  if (destination.protocol !== 'file:') {
    return { diagnostic: diagnostic(source.id, href, 'external-link', 'Non-file URL is not an inter-note relation') }
  }
  if (destination.search) {
    return { diagnostic: diagnostic(source.id, href, 'query-not-supported', 'Query-bearing local links are outside this experiment') }
  }
  if (!href.split(/[?#]/, 1)[0]) {
    return { diagnostic: diagnostic(source.id, href, 'invalid-target', 'Relative Markdown link must name a destination path') }
  }

  let targetPath: string
  try {
    targetPath = resolve(fileURLToPath(destination))
  } catch {
    return { diagnostic: diagnostic(source.id, href, 'invalid-target', 'Markdown destination is not a valid local path') }
  }
  if (!isWithinDirectory(vaultRoot, targetPath)) {
    return { diagnostic: diagnostic(source.id, href, 'outside-vault', 'Destination is outside the experimental vault') }
  }

  const extension = extname(targetPath).toLowerCase()
  if (extension !== '.md') {
    const kind = await pathKindWithoutFollowing(vaultRoot, targetPath, storage)
    return {
      diagnostic: diagnostic(
        source.id,
        href,
        'non-note-target',
        `Destination is not a Markdown note (entry kind: ${kind})`
      )
    }
  }

  const targetNote = notesByPath.get(normalizedPath(targetPath))
  if (targetNote) {
    return {
      link: {
        sourceNoteId: source.id,
        targetNoteId: targetNote.id,
        href,
        ...(destination.hash ? { fragment: destination.hash.slice(1) } : {})
      }
    }
  }

  const targetKind = await pathKindWithoutFollowing(vaultRoot, targetPath, storage)
  if (targetKind === 'missing') {
    return { diagnostic: diagnostic(source.id, href, 'missing-note', 'Markdown note target does not exist') }
  }
  return {
    diagnostic: diagnostic(source.id, href, 'non-note-target', 'Markdown file is not indexed as a canonical note')
  }
}

export function extractMarkdownLinkHrefs(source: string): string[] {
  const hrefs: string[] = []
  for (const block of markdown.parse(source, {})) {
    if (block.type !== 'inline' || !block.children) continue
    for (const token of block.children) {
      if (token.type !== 'link_open') continue
      const href = token.attrGet('href')
      if (typeof href === 'string') hrefs.push(href)
    }
  }
  return hrefs
}

export async function rebuildNoteLinkIndex(
  directories: ExperimentalNoteDirectories,
  storage: StoragePort
): Promise<ExperimentalNoteLinkIndex> {
  const { vaultRoot } = await validateNoteDirectories(directories, storage)
  const { notesById, records } = await readNotes(directories, vaultRoot, storage)
  const notesByPath = new Map([...notesById.values()].map((note) => [normalizedPath(note.path), note]))
  const outgoing = new Map<string, IndexedNoteLink[]>([...notesById.keys()].map((id) => [id, []]))
  const backlinks = new Map<string, Set<string>>([...notesById.keys()].map((id) => [id, new Set<string>()]))
  const diagnostics: NoteLinkDiagnostic[] = []

  for (const note of notesById.values()) {
    const record = records.get(normalizedPath(note.path))
    if (!record) throw new Error(`Experimental note record disappeared during indexing: ${note.path}`)

    let source: string
    try {
      source = bodyDecoder.decode(record.body)
    } catch {
      diagnostics.push(diagnostic(note.id, '', 'invalid-body-utf8', 'Note body is not valid UTF-8; link extraction skipped'))
      continue
    }

    const tokens = markdown.parse(source, {})
    for (const block of tokens) {
      if (block.type !== 'inline' || !block.children) continue
      for (const token of block.children) {
        if (token.type === 'image') {
          const imageSource = token.attrGet('src')
          diagnostics.push(diagnostic(
            note.id,
            typeof imageSource === 'string' ? imageSource : '',
            'image-excluded',
            'Images are not indexed as note links'
          ))
          continue
        }
        if (token.type !== 'link_open') continue

        const href = token.attrGet('href')
        if (typeof href !== 'string') {
          diagnostics.push(diagnostic(note.id, '', 'invalid-target', 'Markdown link token has no href'))
          continue
        }
        const result = await classifyLink(note, href, vaultRoot, notesByPath, storage)
        if (result.diagnostic) diagnostics.push(result.diagnostic)
        if (result.link) {
          outgoing.get(note.id)?.push(result.link)
          backlinks.get(result.link.targetNoteId)?.add(note.id)
        }
      }
    }
  }

  return {
    notesById,
    outgoingByNoteId: new Map([...outgoing].map(([id, links]) => [id, Object.freeze([...links])])),
    backlinksByNoteId: new Map([...backlinks].map(([id, sources]) => [id, Object.freeze([...sources])])),
    diagnostics: Object.freeze(diagnostics)
  }
}

export async function renameNoteTitle(
  path: string,
  title: string,
  storage: StoragePort
): Promise<RecordSnapshot> {
  const original = await readRecord(path, storage)
  return saveMetadata(original, { ...original.metadata, title }, storage)
}