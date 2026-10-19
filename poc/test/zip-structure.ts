import { open } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'

// Leitura mínima das estruturas finais de um ZIP para o AC-13 (APPNOTE 4.3.14–4.3.16): EOCD, localizador e registro ZIP64,
// e o campo extra ZIP64 (0x0001) de cada entrada do diretório central. Só lê; não valida o conteúdo.
export interface ZipStructure {
  eocdEntries: number
  eocdCentralSize: number
  eocdCentralOffset: number
  zip64: { entries: bigint; centralSize: bigint; centralOffset: bigint } | null
  centralEntries: Array<{ name: string; hasZip64Extra: boolean; compressedField: number; uncompressedField: number; localOffsetField: number }>
}

const EOCD = 0x06054b50
const LOCATOR = 0x07064b50
const EOCD64 = 0x06064b50
const CENTRAL = 0x02014b50

async function readExactly(handle: FileHandle, length: number, position: number): Promise<Buffer> {
  if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(length) || length < 0) throw new Error('invalid ZIP range')
  const { size } = await handle.stat()
  if (position + length > size) throw new Error('ZIP range exceeds the file')
  const bytes = Buffer.alloc(length)
  let offset = 0
  while (offset < length) {
    const { bytesRead } = await handle.read(bytes, offset, length - offset, position + offset)
    if (bytesRead === 0) throw new Error('truncated ZIP structure')
    offset += bytesRead
  }
  return bytes
}

export async function readZipStructure(path: string, options: { listCentral?: boolean } = {}): Promise<ZipStructure> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    const tailLength = Math.min(size, 65_557 + 20 + 56)
    const tail = await readExactly(handle, tailLength, size - tailLength)
    let eocd = -1
    for (let offset = tailLength - 22; offset >= 0; offset -= 1) {
      if (tail.readUInt32LE(offset) === EOCD && offset + 22 + tail.readUInt16LE(offset + 20) === tailLength) { eocd = offset; break }
    }
    if (eocd < 0) throw new Error('end of central directory not found')
    const structure: ZipStructure = {
      eocdEntries: tail.readUInt16LE(eocd + 10),
      eocdCentralSize: tail.readUInt32LE(eocd + 12),
      eocdCentralOffset: tail.readUInt32LE(eocd + 16),
      zip64: null,
      centralEntries: []
    }
    let centralOffset = BigInt(structure.eocdCentralOffset)
    let centralSize = BigInt(structure.eocdCentralSize)
    if (eocd >= 20 && tail.readUInt32LE(eocd - 20) === LOCATOR) {
      const recordOffset = tail.readBigUInt64LE(eocd - 20 + 8)
      const record = await readExactly(handle, 56, Number(recordOffset))
      if (record.readUInt32LE(0) !== EOCD64) throw new Error('ZIP64 locator points to a missing ZIP64 end of central directory record')
      structure.zip64 = { entries: record.readBigUInt64LE(32), centralSize: record.readBigUInt64LE(40), centralOffset: record.readBigUInt64LE(48) }
      centralOffset = structure.zip64.centralOffset
      centralSize = structure.zip64.centralSize
    }
    if (options.listCentral !== false) {
      const central = await readExactly(handle, Number(centralSize), Number(centralOffset))
      for (let offset = 0; offset < central.length;) {
        if (offset + 46 > central.length) throw new Error('truncated central directory header')
        if (central.readUInt32LE(offset) !== CENTRAL) throw new Error(`central directory header expected at ${offset}`)
        const nameLength = central.readUInt16LE(offset + 28)
        const extraLength = central.readUInt16LE(offset + 30)
        const commentLength = central.readUInt16LE(offset + 32)
        if (offset + 46 + nameLength + extraLength + commentLength > central.length) throw new Error('truncated central directory entry')
        const name = central.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
        let hasZip64Extra = false
        const extraStart = offset + 46 + nameLength
        for (let field = extraStart; field < extraStart + extraLength;) {
          if (field + 4 > extraStart + extraLength) throw new Error('truncated extra field header')
          const end = field + 4 + central.readUInt16LE(field + 2)
          if (end > extraStart + extraLength) throw new Error('truncated extra field')
          const id = central.readUInt16LE(field)
          if (id === 0x0001) hasZip64Extra = true
          field = end
        }
        structure.centralEntries.push({
          name,
          hasZip64Extra,
          compressedField: central.readUInt32LE(offset + 20),
          uncompressedField: central.readUInt32LE(offset + 24),
          localOffsetField: central.readUInt32LE(offset + 42)
        })
        offset = extraStart + extraLength + commentLength
      }
      if (BigInt(structure.centralEntries.length) !== (structure.zip64?.entries ?? BigInt(structure.eocdEntries))) throw new Error('central directory count mismatch')
    }
    return structure
  } finally {
    await handle.close()
  }
}
