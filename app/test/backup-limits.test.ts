import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { ZipFile } from 'yazl'
import { BackupFileSystem } from '../src/vault/backup/backup-fs.js'
import { BackupBlockedError } from '../src/vault/backup/errors.js'
import { exportBackup, exportSpaceRequirement } from '../src/vault/backup/export.js'
import { buildManifest, manifestSizeBound, PATH_LIMITS, pathLimitProblem, serializeManifest } from '../src/vault/backup/manifest.js'
import { DEFAULT_DESTINATION_PATH_LIMITS, restoreBackup, type RestoreOptions } from '../src/vault/backup/restore.js'

// AC-07 com os valores da D-015 (VAULT_CONTRACT §7.5). A razão de compressão (S-1) continua sem valor e não é testada.
const temporaryDirectories: string[] = []
const NOW = new Date('2026-10-18T12:00:00.000Z')
const TAG_ID = '22222222-2222-4222-8222-222222222222'

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

interface Workspace { root: string; vault: string; out: string; restores: string; appData: string }

async function workspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-limits-'))
  temporaryDirectories.push(root)
  const space = { root, vault: join(root, 'vault'), out: join(root, 'out'), restores: join(root, 'restores'), appData: join(root, 'app-data') }
  for (const path of [space.vault, space.out, space.restores]) await mkdir(path)
  await mkdir(join(space.vault, 'tags'))
  await writeFile(join(space.vault, 'tags', `${TAG_ID}.md`), `---\nid: ${TAG_ID}\nschema_version: 1\ntitle: Base\n---\nTag.\n`)
  return space
}

function options(space: Workspace, extra: Partial<RestoreOptions> = {}): RestoreOptions {
  return { parentDirectory: space.restores, folderName: 'r', appDataDirectory: space.appData, activeVaultRoot: space.vault, confirm: () => true, now: () => NOW, ...extra }
}

interface Crafted { name: string; bytes: Buffer; compress?: boolean }

// ZIP sintético: manifesto coerente por padrão; `manifestText` substitui o manifesto; `centralSize` adultera o tamanho no diretório central.
async function craft(path: string, files: Crafted[], extra: { manifestText?: string; centralSize?: [string, number]; declared?: Array<{ path: string; size: number; sha256: string }> } = {}): Promise<void> {
  const declared = extra.declared ?? files.map((file) => ({ path: file.name, size: file.bytes.length, sha256: sha256(file.bytes) }))
  const zip = new ZipFile()
  const chunks: Buffer[] = []
  const done = new Promise<void>((resolve, reject) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve())
    zip.outputStream.on('error', reject)
  })
  for (const file of files) zip.addBuffer(file.bytes, file.name, { compress: file.compress ?? false, mtime: NOW, mode: 0o100644 })
  zip.addBuffer(extra.manifestText !== undefined ? Buffer.from(extra.manifestText) : serializeManifest(buildManifest(declared, NOW)), 'manifest.json', { compress: false, mtime: NOW, mode: 0o100644 })
  zip.end()
  await done
  const bytes = Buffer.concat(chunks)
  if (extra.centralSize) {
    const [name, size] = extra.centralSize
    for (let offset = 0; offset < bytes.length - 46; offset += 1) {
      if (bytes.readUInt32LE(offset) !== 0x02014b50) continue
      const length = bytes.readUInt16LE(offset + 28)
      if (bytes.subarray(offset + 46, offset + 46 + length).toString('utf8') === name) bytes.writeUInt32LE(size, offset + 24)
    }
  }
  await writeFile(path, bytes)
}

const file = (name: string, text = 'x'): Crafted => ({ name, bytes: Buffer.from(text) })

function segments(count: number, size: number, char = 'a'): string {
  return Array.from({ length: count }, (_, index) => char.repeat(Math.max(1, size - String(index).length)) + String(index)).join('/')
}

async function canCreateLongPaths(root: string): Promise<boolean> {
  try {
    const deep = join(root, 'probe', ...Array.from({ length: 4 }, () => 'p'.repeat(100)))
    await mkdir(deep, { recursive: true })
    await writeFile(join(deep, 'f.txt'), 'x')
    await rm(join(root, 'probe'), { recursive: true, force: true })
    return true
  } catch {
    await rm(join(root, 'probe'), { recursive: true, force: true }).catch(() => undefined)
    return false
  }
}

test('AC-07 (D-015): limites de caminho nas fronteiras', () => {
  assert.equal(pathLimitProblem(segments(4, 255)), null)
  assert.equal(pathLimitProblem(`${'a'.repeat(255)}/b`), null)
  assert.equal(pathLimitProblem(`${'a'.repeat(256)}/b`)?.code, 'segment-too-long')
  const at1024 = `${segments(4, 200)}/${'z'.repeat(1024 - segments(4, 200).length - 1)}`
  assert.equal(at1024.length, 1024)
  assert.equal(pathLimitProblem(at1024), null)
  assert.equal(pathLimitProblem(`${at1024}z`)?.code, 'path-too-long')
  // 3 bytes UTF-8 por unidade é o máximo; no limite de 1.024 unidades, o caminho tem no máximo 3.072 bytes.
  const dense = Array.from({ length: 4 }, () => '€'.repeat(255)).join('/') + '/' + '€'.repeat(1024 - 4 * 256)
  assert.equal(dense.length, 1024)
  assert.ok(Buffer.byteLength(dense) <= PATH_LIMITS.maxPathBytes)
  assert.equal(pathLimitProblem(dense), null)
  assert.equal(pathLimitProblem(Array.from({ length: 32 }, () => 'd').join('/')), null)
  assert.equal(pathLimitProblem(Array.from({ length: 33 }, () => 'd').join('/'))?.code, 'path-too-deep')
  assert.equal(pathLimitProblem('assets/a\u0001b')?.code, 'control-character')
  assert.equal(pathLimitProblem('assets/a\u001fb')?.code, 'control-character')
  assert.equal(pathLimitProblem('assets/a b'), null)
  assert.equal(manifestSizeBound(0), 256)
  assert.equal(manifestSizeBound(10), 256 + 10 * (150 + 2 * 3072))
})

test('AC-07 (D-015): segurança na restauração recusa antes de escrever', async (context) => {
  const cases: Array<[string, (archive: string) => Promise<void>, string, string]> = [
    ['caractere de controle', (archive) => craft(archive, [file('assets/a\u0001b.txt')]), 'control-character', 'security'],
    ['caminho acima de 1.024 unidades', (archive) => craft(archive, [file(`assets/${segments(5, 205)}`)]), 'path-too-long', 'security'],
    ['segmento acima de 255', (archive) => craft(archive, [file(`assets/${'s'.repeat(256)}`)]), 'segment-too-long', 'security'],
    ['profundidade acima de 32', (archive) => craft(archive, [file(Array.from({ length: 33 }, () => 'd').join('/'))]), 'path-too-deep', 'security'],
    ['manifesto acima do teto', (archive) => {
      const manifest = serializeManifest(buildManifest([{ path: 'assets/a.txt', size: 1, sha256: sha256(Buffer.from('x')) }], NOW)).toString('utf8')
      return craft(archive, [file('assets/a.txt')], { manifestText: manifest.replace(/\n$/, ' '.repeat(manifestSizeBound(1) - manifest.length + 1) + '\n') })
    }, 'manifest-too-large', 'security'],
    ['file_count incoerente', (archive) => craft(archive, [file('assets/a.txt')], { manifestText: JSON.stringify({ manifest_version: 1, created_at: NOW.toISOString(), file_count: 2, files: [{ path: 'assets/a.txt', size: 1, sha256: sha256(Buffer.from('x')) }] }) }), 'invalid-manifest', 'structure']
  ]
  for (const [name, arrange, code, category] of cases) {
    await context.test(name, async () => {
      const space = await workspace()
      const archive = join(space.out, 'a.zip')
      await arrange(archive)
      let confirmed = false
      const report = await restoreBackup(archive, options(space, { confirm: () => { confirmed = true; return true } }))
      assert.equal(report.state, 'failed')
      assert.ok(report.errors.some((entry) => entry.code === code && entry.category === category), JSON.stringify(report.errors))
      assert.ok(report.errors.every((entry) => entry.stage === 'pre-validation'))
      assert.equal(confirmed, false)
      assert.deepEqual(await readdir(space.restores), [])
    })
  }
})

test('AC-07 (D-015): manifesto exatamente no teto é aceito', async () => {
  const space = await workspace()
  const archive = join(space.out, 'a.zip')
  const manifest = serializeManifest(buildManifest([{ path: 'assets/a.txt', size: 1, sha256: sha256(Buffer.from('x')) }], NOW)).toString('utf8')
  const padded = manifest.replace(/\n$/, ' '.repeat(manifestSizeBound(1) - manifest.length) + '\n')
  assert.equal(Buffer.byteLength(padded), manifestSizeBound(1))
  await craft(archive, [file('assets/a.txt')], { manifestText: padded })
  const report = await restoreBackup(archive, options(space))
  assert.equal(report.state, 'verified', JSON.stringify(report.errors))
})

test('AC-07: cabeçalho que declara menos bytes do que contém é recusado e a leitura não passa do declarado', async () => {
  const space = await workspace()
  const archive = join(space.out, 'a.zip')
  const content = Buffer.alloc(64 * 1024, 0x61)
  await craft(archive, [{ name: 'assets/a.bin', bytes: content, compress: true }], {
    centralSize: ['assets/a.bin', 1024],
    declared: [{ path: 'assets/a.bin', size: 1024, sha256: sha256(content.subarray(0, 1024)) }]
  })
  const report = await restoreBackup(archive, options(space))
  assert.equal(report.state, 'failed')
  assert.ok(report.errors.every((entry) => entry.stage === 'pre-validation'), JSON.stringify(report.errors))
  assert.match(JSON.stringify(report.errors), /too many bytes/)
  assert.deepEqual(await readdir(space.restores), [])
})

test('AC-07 (D-015, C-4): caminho absoluto no destino é conferido antes da confirmação', async (context) => {
  await context.test('fronteiras de arquivo e de diretório com limites injetados', async () => {
    const space = await workspace()
    const archive = join(space.out, 'a.zip')
    const path = 'assets/dir/f.txt'
    await craft(archive, [file(path)])
    const destination = join(await (new BackupFileSystem()).realpath(space.restores), 'r')
    const fileLength = destination.length + 1 + path.length
    const deepestDirectory = Math.max(destination.length + 1 + 'assets/dir'.length, destination.length + 1 + 'notes/permanent'.length)

    let confirmed = false
    const tooShortFile = await restoreBackup(archive, options(space, { pathLimits: { file: fileLength - 1, directory: 10_000 }, confirm: () => { confirmed = true; return true } }))
    assert.equal(tooShortFile.state, 'failed')
    assert.deepEqual(tooShortFile.errors.map((entry) => [entry.code, entry.category, entry.stage, entry.path]), [['absolute-path-too-long', 'capacity', 'destination', path]])
    assert.equal(confirmed, false)

    const tooShortDirectory = await restoreBackup(archive, options(space, { pathLimits: { file: 10_000, directory: deepestDirectory - 1 } }))
    assert.equal(tooShortDirectory.state, 'failed')
    assert.ok(tooShortDirectory.errors.every((entry) => entry.code === 'absolute-path-too-long'))
    assert.deepEqual(await readdir(space.restores), [])

    const exact = await restoreBackup(archive, options(space, { pathLimits: { file: fileLength, directory: deepestDirectory } }))
    assert.equal(exact.state, 'verified', JSON.stringify(exact.errors))
  })

  await context.test('limites padrão 259/247 recusam; limite de caminhos longos aceita e restaura', async () => {
    const space = await workspace()
    if (!(await canCreateLongPaths(space.root))) {
      context.skip('ambiente sem caminhos longos para o processo Node')
      return
    }
    assert.deepEqual(DEFAULT_DESTINATION_PATH_LIMITS, { file: 259, directory: 247 })
    const archive = join(space.out, 'a.zip')
    const long = `assets/${segments(3, 200)}/f.txt`
    await craft(archive, [file(long, 'longo')])
    const refused = await restoreBackup(archive, options(space))
    assert.equal(refused.state, 'failed')
    assert.ok(refused.errors.some((entry) => entry.code === 'absolute-path-too-long'))
    assert.deepEqual(await readdir(space.restores), [])

    const accepted = await restoreBackup(archive, options(space, { pathLimits: { file: 32_767, directory: 32_767 } }))
    assert.equal(accepted.state, 'verified', JSON.stringify(accepted.errors))
    assert.equal((await readFile(join(space.restores, 'r', ...long.split('/')))).toString(), 'longo')
  })
})

class FixedSpaceFileSystem extends BackupFileSystem {
  constructor(private readonly bytes: bigint) { super() }
  override async freeSpace(): Promise<bigint> {
    return this.bytes
  }
}

const includeAll = () => ({ nonCanonical: {} })

test('AC-07 (D-015): exportação simétrica e espaço livre', async (context) => {
  await context.test('profundidade acima de 32 bloqueia a exportação', async () => {
    const space = await workspace()
    const deep = join(space.vault, 'assets', ...Array.from({ length: 32 }, () => 'd'))
    await mkdir(deep, { recursive: true })
    await writeFile(join(deep, 'f.txt'), 'x')
    await assert.rejects(exportBackup(space.vault, join(space.out, 'b.zip'), { decide: includeAll, now: () => NOW }), (error: unknown) => {
      assert.ok(error instanceof BackupBlockedError)
      assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.category]), [['path-too-deep', 'security']])
      return true
    })
    assert.deepEqual(await readdir(space.out), [])
  })

  await context.test('caminho acima de 1.024 unidades bloqueia a exportação', async () => {
    const space = await workspace()
    if (!(await canCreateLongPaths(space.root))) {
      context.skip('ambiente sem caminhos longos para o processo Node')
      return
    }
    const parts = segments(5, 205).split('/')
    await mkdir(join(space.vault, 'assets', ...parts.slice(0, -1)), { recursive: true })
    await writeFile(join(space.vault, 'assets', ...parts), 'x')
    await assert.rejects(exportBackup(space.vault, join(space.out, 'b.zip'), { decide: includeAll, now: () => NOW }), (error: unknown) => {
      assert.ok(error instanceof BackupBlockedError)
      assert.deepEqual(error.diagnostics.map((entry) => entry.code), ['path-too-long'])
      return true
    })
  })

  await context.test('espaço livre: um byte a menos falha antes do temporário; exatamente o exigido exporta', async () => {
    const space = await workspace()
    await mkdir(join(space.vault, 'assets'))
    await writeFile(join(space.vault, 'assets', 'a.bin'), Buffer.alloc(5000, 1))
    const tagBytes = (await readFile(join(space.vault, 'tags', `${TAG_ID}.md`))).length
    const required = exportSpaceRequirement([{ size: 5000 }, { size: tagBytes }])
    assert.equal(required, 5000 + tagBytes + 2 * (100 + 2 * 3072) + manifestSizeBound(2))

    await assert.rejects(exportBackup(space.vault, join(space.out, 'b.zip'), { decide: includeAll, now: () => NOW, fs: new FixedSpaceFileSystem(BigInt(required - 1)) }), (error: unknown) => {
      assert.ok(error instanceof BackupBlockedError)
      assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.category]), [['insufficient-space', 'capacity']])
      return true
    })
    assert.deepEqual(await readdir(space.out), [])

    const result = await exportBackup(space.vault, join(space.out, 'b.zip'), { decide: includeAll, now: () => NOW, fs: new FixedSpaceFileSystem(BigInt(required)) })
    assert.equal(result.manifest.file_count, 2)
  })
})
