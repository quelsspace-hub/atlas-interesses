import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { buildManifest, serializeManifest } from '../src/backup/manifest.js'
import { listEntries, openArchive, openEntry } from '../src/backup/verify-archive.js'
import { F2_DATE, type FixtureInventory } from './f2-fixture.js'

export type CompressionLevel = 0 | 1 | 6 | 9
export type Corruption = 'size' | 'hash' | 'truncated'

// Somente laboratório. Não altera a política store do exportador do produto.
export async function writeExperimentArchive(root: string, inventory: FixtureInventory, archive: string, level: CompressionLevel, corruption?: Corruption): Promise<void> {
  const manifest = buildManifest(inventory.files, new Date(F2_DATE))
  if (corruption === 'size') manifest.files[0].size -= 1
  if (corruption === 'hash') manifest.files[0].sha256 = '0'.repeat(64)
  const zip = new ZipFile()
  const output = createWriteStream(archive, { flags: 'wx' })
  // Conectar erros antes de adicionar arquivos; um erro de origem encerra também o pipeline.
  zip.on('error', (error: Error) => output.destroy(error))
  const done = pipeline(zip.outputStream, output)
  try {
    const options = { mtime: new Date(F2_DATE), mode: 0o100644, compress: level !== 0, compressionLevel: level }
    for (const file of inventory.files) zip.addFile(join(root, file.path), file.path, options)
    zip.addBuffer(serializeManifest(manifest), 'manifest.json', options)
    zip.end()
    await done
  } catch (error) {
    output.destroy()
    await done.catch(() => undefined)
    throw error
  }
  if (corruption === 'size' || corruption === 'truncated') {
    // Fixtures pequenas e clássicas apenas. A produção não importa este mutador.
    const bytes = await readFile(archive)
    const eocd = bytes.length - 22
    if (bytes.readUInt32LE(eocd) !== 0x06054b50) throw new Error('experiment requires classic ZIP without comment')
    const central = bytes.readUInt32LE(eocd + 16)
    if (bytes.readUInt32LE(central) !== 0x02014b50) throw new Error('central header missing')
    const local = bytes.readUInt32LE(central + 42)
    if (corruption === 'size') {
      const size = bytes.readUInt32LE(central + 24) - 1
      bytes.writeUInt32LE(size, central + 24)
      bytes.writeUInt32LE(size, local + 22)
    } else {
      // Torna só a primeira metade do payload acessível ao descompressor.
      // O diretório central e os outros payloads continuam intactos/acessíveis.
      const compressed = Math.floor(bytes.readUInt32LE(central + 20) / 2)
      bytes.writeUInt32LE(compressed, central + 20)
      bytes.writeUInt32LE(compressed, local + 18)
    }
    await writeFile(archive, bytes)
  }
}

export interface EntryMeasurement {
  path: string
  method: number
  uncompressed: number
  compressed: number
  actualBytes: number
  sha256: string
  ratio: number | null
}

export async function measureEntries(archive: string): Promise<EntryMeasurement[]> {
  const zip = await openArchive(archive)
  try {
    const entries = await listEntries(zip)
    const measurements: EntryMeasurement[] = []
    for (const entry of entries) {
      if (entry.uncompressedSize > 0 && entry.compressedSize === 0) throw new Error('invalid zero compressed size')
      const stream = await openEntry(zip, entry)
      const hash = createHash('sha256')
      let actualBytes = 0
      for await (const chunk of stream) { hash.update(chunk as Buffer); actualBytes += (chunk as Buffer).length }
      if (actualBytes !== entry.uncompressedSize) throw new Error('entry size mismatch')
      measurements.push({ path: entry.fileName, method: entry.compressionMethod, uncompressed: entry.uncompressedSize, compressed: entry.compressedSize, actualBytes, sha256: hash.digest('hex'), ratio: actualBytes === 0 ? null : actualBytes / entry.compressedSize })
    }
    return measurements
  } finally { zip.close() }
}
