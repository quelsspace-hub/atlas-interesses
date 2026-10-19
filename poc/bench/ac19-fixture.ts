import { createCipheriv, createHash } from 'node:crypto'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Gerador sintético e reproduzível das séries do AC-19 (TEST_PLAN §10 e §12.2, F-3 em degraus).
// Bytes de anexos: AES-256-CTR sobre zeros, com chave derivada da semente e do rótulo do arquivo.
export const FIXTURE_SEED = 'atlas-ac19-v1'
const CHUNK = 1024 * 1024

export type Series = 'i' | 'ii' | 'iii'

export interface FixtureSpec {
  series: Series
  // (i): tamanho de cada anexo; (ii): número de arquivos; (iii): tamanho do corpo de cada registro.
  step: number
}

export const ATTACHMENT_COUNT = 4
export const SMALL_FILE_SIZE = 4096
export const RECORD_COUNT = 4
const FILES_PER_FOLDER = 500

function derived(label: string, length: number): Buffer {
  return createHash('sha256').update(`${FIXTURE_SEED}\0${label}`).digest().subarray(0, length)
}

export function uuidFor(label: string): string {
  const bytes = derived(`uuid:${label}`, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function writeRandom(path: string, size: number, label: string): Promise<void> {
  const cipher = createCipheriv('aes-256-ctr', derived(`key:${label}`, 32), derived(`iv:${label}`, 16))
  const zeros = Buffer.alloc(CHUNK)
  const handle = await open(path, 'wx')
  try {
    for (let written = 0; written < size; written += CHUNK) {
      const length = Math.min(CHUNK, size - written)
      await handle.write(cipher.update(length === CHUNK ? zeros : zeros.subarray(0, length)))
    }
  } finally {
    await handle.close()
  }
}

function frontmatter(lines: string[]): string {
  return `---\n${lines.join('\n')}\n---\n`
}

// Corpo Markdown ASCII determinístico, com o tamanho pedido em bytes.
async function writeRecord(path: string, id: string, bodySize: number): Promise<void> {
  const head = Buffer.from(frontmatter([`id: ${id}`, 'schema_version: 1', `title: Registro ${id.slice(0, 8)}`, 'note_type: permanent', 'context_item_id: null', 'tag_ids: []']))
  const line = Buffer.from('Linha de texto sintético para medir a validação de registros grandes.\n')
  const handle = await open(path, 'wx')
  try {
    await handle.write(head)
    const block = Buffer.alloc(CHUNK)
    for (let offset = 0; offset < CHUNK; offset += line.length) line.copy(block, offset, 0, Math.min(line.length, CHUNK - offset))
    for (let written = 0; written < bodySize; written += CHUNK) await handle.write(block.subarray(0, Math.min(CHUNK, bodySize - written)))
  } finally {
    await handle.close()
  }
}

// Gera o vault da série e degrau pedidos. Todas as séries têm a mesma base constante: uma Tag e settings.yml.
export async function generateFixture(vault: string, spec: FixtureSpec): Promise<void> {
  await mkdir(join(vault, 'tags'), { recursive: true })
  const tagId = uuidFor('tag')
  await writeFile(join(vault, 'tags', `${tagId}.md`), `${frontmatter([`id: ${tagId}`, 'schema_version: 1', 'title: Base'])}Tag de base.\n`, { flag: 'wx' })
  await writeFile(join(vault, 'settings.yml'), 'settings_version: 1\n', { flag: 'wx' })

  if (spec.series === 'i') {
    await mkdir(join(vault, 'assets', 'serie-i'), { recursive: true })
    for (let index = 0; index < ATTACHMENT_COUNT; index += 1) {
      await writeRandom(join(vault, 'assets', 'serie-i', `anexo-${index}.bin`), spec.step, `i:${spec.step}:${index}`)
    }
  } else if (spec.series === 'ii') {
    for (let index = 0; index < spec.step; index += 1) {
      const folder = join(vault, 'assets', 'serie-ii', `p${Math.floor(index / FILES_PER_FOLDER)}`)
      if (index % FILES_PER_FOLDER === 0) await mkdir(folder, { recursive: true })
      await writeRandom(join(folder, `f${index}.bin`), SMALL_FILE_SIZE, `ii:${index}`)
    }
  } else {
    await mkdir(join(vault, 'notes', 'permanent'), { recursive: true })
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      const id = uuidFor(`iii:${spec.step}:${index}`)
      await writeRecord(join(vault, 'notes', 'permanent', `${id}.md`), id, spec.step)
    }
  }
}
