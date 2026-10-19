import { createCipheriv, createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { stringify } from 'yaml'
import { parseFrontmatterDocument } from '../src/core/frontmatter.js'
import { compareUtf8, type ManifestFile } from '../src/backup/manifest.js'

export const F2_SEED = 'atlas-f2-v1'
export const F2_DATE = '2026-10-19T00:00:00.000Z'
export const MiB = 1024 * 1024
export const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')

function derived(label: string): Buffer {
  return createHash('sha256').update(`${F2_SEED}\0${label}`).digest()
}

export function f2Uuid(label: string): string {
  const bytes = Buffer.from(derived(`uuid:${label}`).subarray(0, 16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function noise(label: string, size: number): Buffer {
  return createCipheriv('aes-256-ctr', derived(`key:${label}`), derived(`iv:${label}`).subarray(0, 16)).update(Buffer.alloc(size))
}

function pngChunk(type: string, data: Buffer): Buffer {
  const payload = Buffer.concat([Buffer.from(type), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(payload))
  return Buffer.concat([length, payload, crc])
}

function png(pixels: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(256, 0)
  header.writeUInt32BE(256, 4)
  header[8] = 8
  header[9] = 2 // RGB
  const rows = Buffer.alloc(256 * 769)
  for (let row = 0; row < 256; row++) pixels.copy(rows, row * 769 + 1, row * 768, (row + 1) * 768)
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))])
}

function pdf(pixels: Buffer): Buffer {
  const image = deflateSync(pixels, { level: 9 })
  const content = Buffer.from('q 256 0 0 256 0 0 cm /Im0 Do Q\n')
  const stream = (dictionary: string, bytes: Buffer) => Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes, Buffer.from('\nendstream')])
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 256 256] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
    stream('/Type /XObject /Subtype /Image /Width 256 /Height 256 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode', image),
    stream('', content)
  ]
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
  const offsets: number[] = [0]
  let length = parts[0].length
  for (let index = 0; index < objects.length; index++) {
    offsets.push(length)
    const object = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), objects[index], Buffer.from('\nendobj\n')])
    parts.push(object)
    length += object.length
  }
  parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`))
  return Buffer.concat(parts)
}

export interface FixtureFile extends ManifestFile { bodySha256?: string }
export interface FixtureInventory { files: FixtureFile[]; bytes: number; setSha256: string }

// Hash em streaming, inclusive nos degraus F-3; somente registros pequenos são lidos inteiros.
export async function inspectFixture(root: string): Promise<FixtureInventory> {
  const files: FixtureFile[] = []
  async function walk(prefix: string): Promise<void> {
    for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) await walk(path)
      else {
        if (!entry.isFile()) throw new Error(`fixture contains non-regular file: ${path}`)
        const hash = createHash('sha256')
        let size = 0
        for await (const chunk of createReadStream(join(root, path))) { hash.update(chunk); size += chunk.length }
        const bodySha256 = !path.startsWith('assets/') && path.endsWith('.md')
          ? sha256(parseFrontmatterDocument(await readFile(join(root, path))).body) : undefined
        files.push({ path, size, sha256: hash.digest('hex'), ...(bodySha256 ? { bodySha256 } : {}) })
      }
    }
  }
  await walk('')
  files.sort((a, b) => compareUtf8(a.path, b.path))
  return { files, bytes: files.reduce((sum, file) => sum + file.size, 0), setSha256: sha256(JSON.stringify(files)) }
}

// Exige raiz nova. Não sobrescreve fixture existente nem usa o relógio do sistema.
export async function generateF2(root: string): Promise<FixtureInventory> {
  await mkdir(root)
  const put = async (path: string, bytes: Buffer | string) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), bytes, { flag: 'wx' })
  }
  const tagA = f2Uuid('tag-a'), tagB = f2Uuid('tag-b'), project = f2Uuid('project')
  const records: Array<[string, string, Record<string, unknown>]> = [
    ['tags', 'tag-a', {}], ['tags', 'tag-b', {}],
    ['groups', 'group-a', { tag_ids: [tagA], sort_order: 0 }],
    ['groups', 'group-b', { tag_ids: [tagA, tagB], sort_order: 1 }],
    ['items', 'project', { type: 'project', status: 'active', tag_ids: [tagA], progress_mode: 'tasks' }],
    ['items', 'interest', { type: 'interest', status: 'active', tag_ids: [tagB], progress_mode: 'none' }],
    ['tasks', 'task', { status: 'todo', project_id: project, sort_order: 0, is_next_action: true, completed_at: null }],
    ['notes/work', 'work', { note_type: 'work', context_item_id: project, tag_ids: [tagA] }],
    ['notes/reading', 'reading', { note_type: 'reading', context_item_id: null, tag_ids: [tagB] }],
    ['notes/permanent', 'permanent', { note_type: 'permanent', context_item_id: null, tag_ids: [] }]
  ]
  for (const [index, [folder, label, extra]] of records.entries()) {
    const eol = index % 2 ? '\r\n' : '\n'
    const metadata = { id: f2Uuid(label), schema_version: 1, title: `Amostra ${label}`, created_at: F2_DATE, updated_at: F2_DATE, archived_at: null, ...extra }
    const link = folder.startsWith('notes/') ? `[Origem](../reading/${f2Uuid('reading')}.md)\n` : ''
    const head = Buffer.from(`---\n${stringify(metadata)}---\n# Conhecimento e ação\n${link}Acentos: ação, café.  \n\n\`\`\`text\ntexto sintético\n\`\`\`\n`.replaceAll('\n', eol))
    const line = Buffer.from(`Texto repetitivo de referência.  ${eol}`)
    const bytes = Buffer.alloc(64 * 1024, 0x20)
    head.copy(bytes)
    for (let offset = head.length; offset + line.length <= bytes.length; offset += line.length) line.copy(bytes, offset)
    await put(`${folder}/${metadata.id}.md`, bytes)
  }
  for (const label of ['noise-a', 'noise-b']) await put(`assets/${label}.bin`, noise(label, MiB))
  await put('assets/image.png', png(noise('png-pixels', 256 * 256 * 3)))
  await put('assets/document.pdf', pdf(noise('pdf-pixels', 256 * 256 * 3)))
  for (const size of [MiB, 8 * MiB]) {
    await put(`assets/zeros-${size}.bin`, Buffer.alloc(size))
    const pattern = Buffer.from('ação e conhecimento\n')
    const text = Buffer.alloc(size, 0x20)
    for (let offset = 0; offset + pattern.length <= size; offset += pattern.length) pattern.copy(text, offset)
    await put(`assets/text-${size}.txt`, text)
  }
  await put('assets/empty.bin', Buffer.alloc(0))
  await put('assets/tiny.txt', '0123456789abcdef0123456789abcdef')
  await put('settings.yml', 'settings_version: 1\n')
  return inspectFixture(root)
}

export async function generateExpansion(root: string, count: 8 | 32): Promise<FixtureInventory> {
  await mkdir(root)
  await mkdir(join(root, 'assets'))
  const zeros = Buffer.alloc(8 * MiB)
  for (let index = 0; index < count; index++) await writeFile(join(root, 'assets', `zeros-${String(index).padStart(2, '0')}.bin`), zeros, { flag: 'wx' })
  return inspectFixture(root)
}
