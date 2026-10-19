import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, truncate, unlink, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { afterEach, test } from 'node:test'
import { stringify } from 'yaml'
import * as yauzl from 'yauzl'
import { BackupFileSystem } from '../src/backup/backup-fs.js'
import {
  BackupBlockedError,
  BackupCancelledError,
  BackupConcurrentChangeError,
  BackupDecisionError,
  BackupDestinationError,
  BackupVerificationError,
  BackupWriteError
} from '../src/backup/errors.js'
import { exportBackup, type ExportDecisions } from '../src/backup/export.js'
import type { VaultInventory } from '../src/backup/inventory.js'
import { compareUtf8 } from '../src/backup/manifest.js'

const temporaryDirectories: string[] = []
const NOW = new Date('2026-10-18T12:00:00.000Z')
const ids = {
  group: '11111111-1111-4111-8111-111111111111',
  tag: '22222222-2222-4222-8222-222222222222',
  item: '33333333-3333-4333-8333-333333333333',
  task: '44444444-4444-4444-8444-444444444444',
  work: '55555555-5555-4555-8555-555555555555',
  reading: '66666666-6666-4666-8666-666666666666',
  capture: '77777777-7777-4777-8777-777777777777',
  orphan: '88888888-8888-4888-8888-888888888888'
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function workspace(): Promise<{ vault: string; out: string }> {
  // Caminho real: o exportador/restaurador relatam destinos resolvidos; no Windows, TEMP pode vir em 8.3 (ex.: RUNNER~1).
  const root = await realpath(await mkdtemp(join(tmpdir(), 'atlas-backup-')))
  temporaryDirectories.push(root)
  const vault = join(root, 'vault')
  const out = join(root, 'out')
  await mkdir(vault)
  await mkdir(out)
  return { vault, out }
}

async function put(vault: string, path: string, bytes: Buffer | string): Promise<void> {
  const target = join(vault, ...path.split('/'))
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, bytes)
}

function record(metadata: Record<string, unknown>, body: string): string {
  return `---\n${stringify(metadata)}---\n${body}`
}

async function snapshot(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = join(directory, entry.name)
      if (entry.isSymbolicLink()) result.set(path, 'link')
      else if (entry.isDirectory()) {
        result.set(path, 'dir')
        await visit(absolute, path)
      } else result.set(path, sha256(await readFile(absolute)))
    }
  }
  await visit(root, '')
  return result
}

function readArchive(path: string): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) return reject(error)
      const entries = new Map<string, Buffer>()
      zipfile.on('entry', (entry: yauzl.Entry) => {
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError)
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => {
            entries.set(entry.fileName, Buffer.concat(chunks))
            zipfile.readEntry()
          })
        })
      })
      zipfile.on('end', () => resolve(entries))
      zipfile.on('error', reject)
      zipfile.readEntry()
    })
  })
}

function includeAll(inventory: VaultInventory): ExportDecisions {
  return {
    nonCanonical: Object.fromEntries(inventory.nonCanonical.map((file) => [file.path, 'include' as const])),
    ...(inventory.systemFiles.length > 0 ? { systemFiles: 'include' as const } : {})
  }
}

async function smallVault(vault: string): Promise<void> {
  await put(vault, `tags/${ids.tag}.md`, record({ id: ids.tag, schema_version: 1, title: 'UX' }, '# Tag\n'))
  await put(vault, 'assets/anexo.bin', Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]))
}

async function fixtureF1(vault: string): Promise<void> {
  await put(vault, `groups/${ids.group}.md`, record({ id: ids.group, schema_version: 1, title: 'Design', sort_order: 0, tag_ids: [ids.tag] }, '# Grupo\n'))
  await put(vault, `tags/${ids.tag}.md`, record({ id: ids.tag, schema_version: 1, title: 'UX Design' }, 'Tag.\n'))
  await put(vault, `items/${ids.item}.md`, record(
    { id: ids.item, schema_version: 1, title: 'Projeto arquivado', type: 'project', status: 'archived', archived_at: '2026-10-01T00:00:00.000Z' },
    '# Projeto\r\n\r\nCorpo com CRLF e acentuação: ação.\r\n'
  ))
  await put(vault, `tasks/${ids.task}.md`, record({ id: ids.task, schema_version: 1, title: 'Tarefa', status: 'done' }, 'Feita.\n'))
  await put(vault, `notes/work/${ids.work}.md`, record({ id: ids.work, schema_version: 1, title: 'Nota de trabalho — ação', note_type: 'work', context_item_id: ids.item }, 'Corpo LF.\n'))
  await put(vault, `notes/reading/${ids.reading}.md`, record({ id: ids.reading, schema_version: 1, title: 'Leitura', note_type: 'reading', context_item_id: null }, 'Leitura.'))
  await mkdir(join(vault, 'notes', 'permanent'), { recursive: true })
  await put(vault, `inbox/${ids.capture}.md`, record({ id: ids.capture, schema_version: 1, capture_kind: 'thought', status: 'pending' }, 'Captura sem título.\n'))
  await put(vault, 'assets/fotos/ação.bin', Buffer.from(Array.from({ length: 256 }, (_, index) => (index * 37) % 256)))
  await put(vault, 'assets/Thumbs.db', Buffer.from('miniaturas do sistema'))
  await put(vault, 'settings.yml', 'settings_version: 1\nchave_futura: valor preservado\n')
  await put(vault, 'desktop.ini', '[.ShellClassInfo]\n')
  await put(vault, '.obsidian/workspace.json', '{"cache": true}\n')
  await put(vault, 'leia-me.txt', 'arquivo não canônico\n')
  await mkdir(join(vault, 'vazia'))
  await put(vault, `notes/work/.tmp-${ids.orphan}.md`, 'temporário órfão\n')
}

async function canCreateFileSymlink(directory: string): Promise<boolean> {
  try {
    await writeFile(join(directory, 'probe-target'), 'x')
    await symlink(join(directory, 'probe-target'), join(directory, 'probe-link'), 'file')
    await unlink(join(directory, 'probe-link'))
    return true
  } catch {
    return false
  } finally {
    await rm(join(directory, 'probe-target'), { force: true })
  }
}

test('AC-01: inventário exato, manifesto M-B correto e ZIP publicado só após verificação', async () => {
  const { vault, out } = await workspace()
  await fixtureF1(vault)
  const before = await snapshot(vault)
  const archive = join(out, 'backup.zip')
  let observed: VaultInventory | undefined
  let duringVerification: { finalExists: boolean; temporaryOutsideVault: boolean } | undefined

  const result = await exportBackup(vault, archive, {
    now: () => NOW,
    decide: (inventory) => {
      observed = inventory
      return includeAll(inventory)
    },
    hooks: {
      afterArchiveWritten: async ({ temporaryPath, finalPath }) => {
        const finalExists = await lstat(finalPath).then(() => true, () => false)
        duringVerification = { finalExists, temporaryOutsideVault: !temporaryPath.startsWith(vault) && (await lstat(temporaryPath)).isFile() }
      }
    }
  })

  const expectedIncluded = [
    '.obsidian/workspace.json', 'assets/Thumbs.db', 'assets/fotos/ação.bin', 'desktop.ini',
    `groups/${ids.group}.md`, `inbox/${ids.capture}.md`, `items/${ids.item}.md`, 'leia-me.txt',
    `notes/reading/${ids.reading}.md`, `notes/work/${ids.work}.md`, 'settings.yml', `tags/${ids.tag}.md`, `tasks/${ids.task}.md`
  ].sort(compareUtf8)
  assert.ok(observed)
  assert.deepEqual(observed.nonCanonical.map((file) => file.path).sort(), ['.obsidian/workspace.json', 'leia-me.txt'])
  assert.deepEqual(observed.systemFiles.map((file) => file.path).sort(), ['assets/Thumbs.db', 'desktop.ini'])
  assert.deepEqual(observed.blocks, [])
  assert.deepEqual(result.included, expectedIncluded)
  assert.deepEqual(result.excluded, [{ path: `notes/work/.tmp-${ids.orphan}.md`, reason: 'temporary' }])
  assert.deepEqual(result.emptyDirectories, ['vazia'])

  const { manifest } = result
  assert.equal(manifest.manifest_version, 1)
  assert.equal(manifest.created_at, NOW.toISOString())
  assert.equal(manifest.file_count, expectedIncluded.length)
  assert.deepEqual(manifest.files.map((file) => file.path), expectedIncluded)
  assert.equal(manifest.files.some((file) => file.path === 'manifest.json'), false)
  for (const file of manifest.files) {
    const source = await readFile(join(vault, ...file.path.split('/')))
    assert.equal(file.size, source.length, file.path)
    assert.equal(file.sha256, sha256(source), file.path)
  }

  assert.deepEqual(duringVerification, { finalExists: false, temporaryOutsideVault: true })
  assert.equal(result.archivePath, join(out, 'backup.zip'))
  assert.deepEqual(await readdir(out), ['backup.zip'])
  const entries = await readArchive(archive)
  assert.deepEqual([...entries.keys()].sort(compareUtf8), [...expectedIncluded, 'manifest.json'].sort(compareUtf8))
  for (const path of expectedIncluded) assert.deepEqual(entries.get(path), await readFile(join(vault, ...path.split('/'))), path)
  assert.deepEqual(JSON.parse(entries.get('manifest.json')!.toString('utf8')), manifest)
  assert.ok(entries.get('settings.yml')!.toString('utf8').includes('chave_futura: valor preservado'))
  assert.deepEqual(await snapshot(vault), before)
})

test('AC-01 extensão (A-01/A-10): settings.yml inválido ou com settings_version não suportado bloqueia; ausência não bloqueia', async () => {
  for (const [content, code, category] of [
    ['settings_version: [\n', 'invalid-settings', 'structure'],
    ['chave: sem versão\n', 'invalid-settings', 'structure'],
    ['settings_version: 2\n', 'unsupported-settings-version', 'unsupported-version']
  ] as const) {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await put(vault, 'settings.yml', content)
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), (error: unknown) => {
      assert.ok(error instanceof BackupBlockedError)
      assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.category, entry.path]), [[code, category, 'settings.yml']])
      return true
    })
    assert.deepEqual(await readdir(out), [])
  }
  const { vault, out } = await workspace()
  await smallVault(vault)
  const result = await exportBackup(vault, join(out, 'b.zip'), { decide: includeAll })
  assert.deepEqual(result.included, ['assets/anexo.bin', `tags/${ids.tag}.md`])
})

test('AC-03: transação pendente da Inbox bloqueia a exportação sem deixar ZIP', async () => {
  const { vault, out } = await workspace()
  await smallVault(vault)
  await put(vault, `inbox/.txn_${ids.capture}.json`, '{"stage":"INIT"}')
  const before = await snapshot(vault)
  await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), (error: unknown) => {
    assert.ok(error instanceof BackupBlockedError)
    assert.deepEqual(error.diagnostics.map((entry) => entry.category), ['pending-transaction'])
    assert.equal(error.diagnostics[0].path, `inbox/.txn_${ids.capture}.json`)
    return true
  })
  assert.deepEqual(await readdir(out), [])
  assert.deepEqual(await snapshot(vault), before)
})

test('AC-04: escrita concorrente injetada de forma determinística aborta sem publicar', async (context) => {
  const variants: Array<[string, string, (vault: string) => Promise<void>]> = [
    ['conteúdo com mesmo tamanho', 'assets/anexo.bin', (vault) => writeFile(join(vault, 'assets', 'anexo.bin'), Buffer.from([9, 9, 9, 9, 9, 9, 9, 9]))],
    ['tamanho alterado', 'assets/anexo.bin', (vault) => appendFile(join(vault, 'assets', 'anexo.bin'), Buffer.from([1]))],
    ['arquivo removido', 'assets/anexo.bin', (vault) => unlink(join(vault, 'assets', 'anexo.bin'))],
    ['arquivo novo em pasta inventariada', 'assets/novo.bin', (vault) => writeFile(join(vault, 'assets', 'novo.bin'), 'novo')],
    ['arquivo novo em pasta nova (A-07)', 'pasta-nova', async (vault) => put(vault, 'pasta-nova/x.txt', 'x')]
  ]
  const probe = await workspace()
  const symlinksAvailable = await canCreateFileSymlink(probe.out)
  if (symlinksAvailable) {
    variants.push(['arquivo substituído por link', 'assets/anexo.bin', async (vault) => {
      await unlink(join(vault, 'assets', 'anexo.bin'))
      await writeFile(join(vault, '..', 'alvo-externo.bin'), 'fora do vault')
      await symlink(join(vault, '..', 'alvo-externo.bin'), join(vault, 'assets', 'anexo.bin'), 'file')
    }])
  } else {
    context.diagnostic('variante de link não executada: symlink indisponível neste ambiente (pré-condição DQ-08)')
  }

  for (const [name, changedPath, mutate] of variants) {
    await context.test(name, async () => {
      const { vault, out } = await workspace()
      await smallVault(vault)
      const untouched = `tags/${ids.tag}.md`
      const untouchedHash = sha256(await readFile(join(vault, ...untouched.split('/'))))
      await assert.rejects(
        exportBackup(vault, join(out, 'b.zip'), { decide: includeAll, hooks: { afterArchiveWritten: () => mutate(vault) } }),
        (error: unknown) => {
          assert.ok(error instanceof BackupConcurrentChangeError)
          assert.ok(error.diagnostics.some((entry) => entry.path === changedPath || entry.path.startsWith(`${changedPath}/`)), JSON.stringify(error.diagnostics))
          assert.equal(error.temporaryRemoved, true)
          return true
        }
      )
      assert.deepEqual(await readdir(out), [])
      assert.equal(sha256(await readFile(join(vault, ...untouched.split('/')))), untouchedHash)
    })
  }
})

test('AC-04 limite conhecido: alterar e restaurar os mesmos bytes entre as leituras não é detectado', async () => {
  const { vault, out } = await workspace()
  await smallVault(vault)
  const original = await readFile(join(vault, 'assets', 'anexo.bin'))
  const result = await exportBackup(vault, join(out, 'b.zip'), {
    decide: includeAll,
    hooks: {
      afterArchiveWritten: async () => {
        await writeFile(join(vault, 'assets', 'anexo.bin'), Buffer.from([7, 7, 7, 7, 7, 7, 7, 7]))
        await writeFile(join(vault, 'assets', 'anexo.bin'), original)
      }
    }
  })
  assert.equal(result.archivePath, join(out, 'b.zip'))
})

class FailingWriteFileSystem extends BackupFileSystem {
  override createTempWriteStream(_handle: FileHandle): Writable {
    return new Writable({
      write(_chunk, _encoding, callback) {
        const error = new Error('synthetic EIO while writing the archive') as NodeJS.ErrnoException
        error.code = 'EIO'
        callback(error)
      }
    })
  }
}

test('AC-05: falha de escrita, falha de verificação e cancelamento não publicam nem alteram o vault', async (context) => {
  await context.test('falha de escrita (EIO) remove só o temporário próprio', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    const before = await snapshot(vault)
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll, fs: new FailingWriteFileSystem() }), (error: unknown) => {
      assert.ok(error instanceof BackupWriteError)
      assert.equal(error.temporaryRemoved, true)
      return true
    })
    assert.deepEqual(await readdir(out), [])
    assert.deepEqual(await snapshot(vault), before)
  })

  await context.test('ZIP temporário corrompido falha na releitura e não é publicado', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await assert.rejects(
      exportBackup(vault, join(out, 'b.zip'), { decide: includeAll, hooks: { afterArchiveWritten: ({ temporaryPath }) => truncate(temporaryPath, 40) } }),
      (error: unknown) => {
        assert.ok(error instanceof BackupVerificationError)
        assert.equal(error.temporaryRemoved, true)
        return true
      }
    )
    assert.deepEqual(await readdir(out), [])
  })

  await context.test('cancelamento na decisão do inventário não escreve nada', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: () => 'cancel' }), BackupCancelledError)
    assert.deepEqual(await readdir(out), [])
  })

  await context.test('arquivo alheio com o nome do temporário é preservado', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    const fixedId = '99999999-9999-4999-8999-999999999999'
    const alien = join(out, `.atlas-backup-${fixedId}.zip.tmp`)
    await writeFile(alien, 'arquivo alheio')
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll, generateId: () => fixedId }), (error: unknown) => {
      assert.ok(error instanceof BackupWriteError)
      assert.equal(error.stage, 'create-temporary')
      assert.equal(error.temporaryRemoved, false)
      return true
    })
    assert.equal((await readFile(alien)).toString('utf8'), 'arquivo alheio')
    assert.deepEqual(await readdir(out), [`.atlas-backup-${fixedId}.zip.tmp`])
  })

  await context.test('backup existente nunca é sobrescrito; destino dentro do vault é recusado', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await writeFile(join(out, 'b.zip'), 'backup anterior')
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), BackupDestinationError)
    assert.equal((await readFile(join(out, 'b.zip'))).toString('utf8'), 'backup anterior')
    assert.deepEqual(await readdir(out), ['b.zip'])
    await assert.rejects(exportBackup(vault, join(vault, 'assets', 'b.zip'), { decide: includeAll }), BackupDestinationError)
    assert.deepEqual((await readdir(join(vault, 'assets'))).sort(), ['anexo.bin'])
  })
})

test('AC-10: excluir, cancelar e decidir explicitamente; lista fechada de arquivos de sistema', async (context) => {
  await context.test('excluir não canônico e grupo de sistema', async () => {
    const { vault, out } = await workspace()
    await fixtureF1(vault)
    const result = await exportBackup(vault, join(out, 'b.zip'), {
      decide: (inventory) => ({
        nonCanonical: Object.fromEntries(inventory.nonCanonical.map((file) => [file.path, 'exclude' as const])),
        systemFiles: 'exclude'
      })
    })
    const excluded = result.excluded.map((entry) => `${entry.path}:${entry.reason}`)
    for (const expected of [
      '.obsidian/workspace.json:excluded-by-person', 'leia-me.txt:excluded-by-person',
      'assets/Thumbs.db:system-file-excluded', 'desktop.ini:system-file-excluded'
    ]) assert.ok(excluded.includes(expected), expected)
    const entries = await readArchive(result.archivePath)
    for (const path of ['.obsidian/workspace.json', 'leia-me.txt', 'assets/Thumbs.db', 'desktop.ini']) {
      assert.equal(entries.has(path), false, path)
      assert.equal(result.manifest.files.some((file) => file.path === path), false, path)
    }
  })

  await context.test('decisão ausente nunca omite em silêncio', async () => {
    const { vault, out } = await workspace()
    await fixtureF1(vault)
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: () => ({ nonCanonical: {} }) }), (error: unknown) => {
      assert.ok(error instanceof BackupDecisionError)
      assert.deepEqual([...error.missing].sort(), ['(system files group)', '.obsidian/workspace.json', 'leia-me.txt'])
      return true
    })
    assert.deepEqual(await readdir(out), [])
  })

  await context.test('arquivo fora da lista fechada não é tratado como arquivo de sistema', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await put(vault, 'thumbs.txt', 'parecido, mas fora da lista')
    let observed: VaultInventory | undefined
    await exportBackup(vault, join(out, 'b.zip'), { decide: (inventory) => { observed = inventory; return includeAll(inventory) } })
    assert.deepEqual(observed?.systemFiles, [])
    assert.deepEqual(observed?.nonCanonical.map((file) => file.path), ['thumbs.txt'])
  })

  await context.test('extensão (A-01): registro inválido bloqueia e não é oferecido; .md com outro nome é não canônico', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await put(vault, `notes/work/${ids.work}.md`, '---\ntitle: [quebrado\n---\ncorpo')
    let offered = false
    await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: () => { offered = true; return { nonCanonical: {} } } }), (error: unknown) => {
      assert.ok(error instanceof BackupBlockedError)
      assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.path]), [['invalid-record-yaml', `notes/work/${ids.work}.md`]])
      return true
    })
    assert.equal(offered, false)

    const second = await workspace()
    await smallVault(second.vault)
    await put(second.vault, 'notes/work/README.md', 'sem frontmatter')
    let observed: VaultInventory | undefined
    const result = await exportBackup(second.vault, join(second.out, 'b.zip'), { decide: (inventory) => { observed = inventory; return includeAll(inventory) } })
    assert.deepEqual(observed?.nonCanonical.map((file) => file.path), ['notes/work/README.md'])
    assert.equal((await readArchive(result.archivePath)).get('notes/work/README.md')?.toString('utf8'), 'sem frontmatter')
  })
})

test('Validação simétrica (A-01/A-10): estrutura, versão, identidade, nomes e links bloqueiam a exportação', async (context) => {
  const cases: Array<[string, (vault: string) => Promise<void>, string]> = [
    ['schema_version não suportado', (vault) => put(vault, `items/${ids.item}.md`, record({ id: ids.item, schema_version: 2, title: 'Futuro' }, '')), 'unsupported-schema-version'],
    ['schema_version ausente', (vault) => put(vault, `items/${ids.item}.md`, record({ id: ids.item, title: 'Sem versão' }, '')), 'invalid-record'],
    ['id diferente do nome', (vault) => put(vault, `items/${ids.item}.md`, record({ id: ids.task, schema_version: 1, title: 'Outro id' }, '')), 'record-id-mismatch'],
    ['note_type incoerente com a pasta', (vault) => put(vault, `notes/work/${ids.work}.md`, record({ id: ids.work, schema_version: 1, title: 'N', note_type: 'reading' }, '')), 'record-folder-mismatch'],
    ['UUID duplicado', (vault) => put(vault, `groups/${ids.tag}.md`, record({ id: ids.tag, schema_version: 1, title: 'Dup' }, '')), 'duplicate-uuid'],
    ['manifest.json na raiz', (vault) => put(vault, 'manifest.json', '{}'), 'reserved-name'],
    ['nomes que diferem só pela forma Unicode', async (vault) => {
      await put(vault, 'assets/ação.bin', 'nfc')
      await put(vault, 'assets/ação.bin', 'nfd')
    }, 'ambiguous-name'],
    ['junção dentro do vault', async (vault) => {
      await mkdir(join(vault, '..', 'fora'), { recursive: true })
      await symlink(join(vault, '..', 'fora'), join(vault, 'assets', 'juncao'), 'junction')
    }, 'link-in-vault']
  ]
  for (const [name, arrange, code] of cases) {
    await context.test(name, async () => {
      const { vault, out } = await workspace()
      await smallVault(vault)
      await arrange(vault)
      await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), (error: unknown) => {
        assert.ok(error instanceof BackupBlockedError)
        assert.ok(error.diagnostics.some((entry) => entry.code === code), JSON.stringify(error.diagnostics))
        return true
      })
      assert.deepEqual(await readdir(out), [])
    })
  }
})

test('Nome reservado: manifest.json na raiz bloqueia, sem ZIP, com o arquivo intacto; em subpasta é não canônico', async (context) => {
  for (const name of ['manifest.json', 'Manifest.JSON']) {
    await context.test(`raiz: ${name}`, async () => {
      const { vault, out } = await workspace()
      await smallVault(vault)
      const original = Buffer.from('{"do usuário": true}\n', 'utf8')
      await put(vault, name, original)
      const before = await snapshot(vault)
      await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), (error: unknown) => {
        assert.ok(error instanceof BackupBlockedError)
        assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.category, entry.path]), [['reserved-name', 'structure', name]])
        return true
      })
      assert.deepEqual(await readdir(out), [])
      assert.deepEqual(await readFile(join(vault, name)), original)
      assert.deepEqual(await snapshot(vault), before)
    })
  }
  await context.test('subpasta: assets/manifest.json é anexo e notas/manifest.json é não canônico', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    await put(vault, 'assets/manifest.json', '{"anexo": true}')
    await put(vault, 'notas/manifest.json', '{"outro": true}')
    let observed: VaultInventory | undefined
    const result = await exportBackup(vault, join(out, 'b.zip'), { decide: (inventory) => { observed = inventory; return includeAll(inventory) } })
    assert.deepEqual(observed?.blocks, [])
    assert.deepEqual(observed?.nonCanonical.map((file) => file.path), ['notas/manifest.json'])
    assert.ok(result.included.includes('assets/manifest.json'))
    const entries = await readArchive(result.archivePath)
    assert.equal(entries.get('assets/manifest.json')?.toString('utf8'), '{"anexo": true}')
    assert.equal(entries.get('notas/manifest.json')?.toString('utf8'), '{"outro": true}')
  })
})

test('settings_version: só a versão 1 é suportada pela PoC; ausente, não inteiro ou outra versão bloqueia', async (context) => {
  await context.test('versão 1 é exportada com o arquivo intacto', async () => {
    const { vault, out } = await workspace()
    await smallVault(vault)
    const settings = 'settings_version: 1\n'
    await put(vault, 'settings.yml', settings)
    const result = await exportBackup(vault, join(out, 'b.zip'), { decide: includeAll })
    assert.ok(result.included.includes('settings.yml'))
    assert.equal((await readArchive(result.archivePath)).get('settings.yml')?.toString('utf8'), settings)
  })
  for (const [content, code, category] of [
    ['settings_version: "1"\n', 'invalid-settings', 'structure'],
    ['settings_version: 1.5\n', 'invalid-settings', 'structure'],
    ['settings_version: null\n', 'invalid-settings', 'structure'],
    ['- settings_version: 1\n', 'invalid-settings', 'structure'],
    ['settings_version: 1\nsettings_version: 1\n', 'invalid-settings', 'structure'],
    ['settings_version: 0\n', 'unsupported-settings-version', 'unsupported-version'],
    ['settings_version: -1\n', 'unsupported-settings-version', 'unsupported-version']
  ] as const) {
    await context.test(JSON.stringify(content), async () => {
      const { vault, out } = await workspace()
      await smallVault(vault)
      await put(vault, 'settings.yml', content)
      await assert.rejects(exportBackup(vault, join(out, 'b.zip'), { decide: includeAll }), (error: unknown) => {
        assert.ok(error instanceof BackupBlockedError)
        assert.deepEqual(error.diagnostics.map((entry) => [entry.code, entry.category, entry.path]), [[code, category, 'settings.yml']])
        return true
      })
      assert.deepEqual(await readdir(out), [])
    })
  }
})
