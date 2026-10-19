import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, link, mkdir, open, readFile, rename, rm, unlink } from 'node:fs/promises'
import { sha256 } from './core/record.js'
import { VaultError, type VaultRepository } from './repository.js'
import { isUuid } from '../domain/validate.js'
import type { ConversionType, EntityKind } from '../domain/model.js'

// Transação recuperável de conversão da Inbox (D-002, D-021, D-023; VAULT_CONTRACT §4).
// Etapas: INIT → TMP_WRITTEN → FILES_RENAMED → INBOX_UPDATED → remoção do manifesto.

export type Stage = 'INIT' | 'TMP_WRITTEN' | 'FILES_RENAMED' | 'INBOX_UPDATED'

export const PRIMARY = '$primary'

export interface OutputSpec {
  kind: Extract<EntityKind, 'item' | 'task' | 'note'>
  input: Record<string, unknown>
  body: string
}

interface ManifestOutput {
  id: string
  entity_type: 'item' | 'task' | 'note'
  file: string
  tmp_file: string
  sha256: string
}

interface Manifest {
  schema_version: 1
  capture_id: string
  stage: Stage
  primary_type: ConversionType
  primary_id: string
  outputs: ManifestOutput[]
  created_at: string
}

export interface TransactionHooks {
  // Chamado depois de cada passo persistido; lançar simula interrupção do processo.
  after?: (step: string) => void | Promise<void>
}

export interface RecoveryResult {
  manifest: string
  captureId: string
  outcome: 'completed' | 'discarded' | 'blocked'
  message: string
}

const manifestPath = (captureId: string) => `inbox/.txn_${captureId}.json`
const allowedFile = /^(items|tasks|notes\/work|notes\/reading|notes\/permanent)\/[0-9a-f-]{36}\.md$/
const allowedTmp = /^(items|tasks|notes\/work|notes\/reading|notes\/permanent)\/\.tmp-[0-9a-f-]{36}\.md$/

function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException)?.code
}

async function writeExclusiveSynced(path: string, bytes: Buffer): Promise<void> {
  const handle = await open(path, 'wx')
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function hashOf(path: string): Promise<string | null> {
  try {
    return sha256(await readFile(path))
  } catch (error) {
    if (errno(error) === 'ENOENT') return null
    throw error
  }
}

// Promove sem substituir destino alheio: hard link (atômico no NTFS) ou cópia exclusiva como alternativa.
async function promote(tmp: string, final: string): Promise<void> {
  try {
    await link(tmp, final)
  } catch (error) {
    const code = errno(error)
    if (code === 'EEXIST') throw error
    if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EXDEV' && code !== 'ENOSYS') throw error
    await copyFile(tmp, final, constants.COPYFILE_EXCL)
  }
  await unlink(tmp)
}

export class InboxTransactions {
  constructor(private readonly repo: VaultRepository, private readonly clock: () => Date = () => new Date()) {}

  private async writeManifest(manifest: Manifest, initial: boolean): Promise<void> {
    const path = this.repo.abs(manifestPath(manifest.capture_id))
    const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    if (initial) {
      try {
        await writeExclusiveSynced(path, bytes)
      } catch (error) {
        if (errno(error) === 'EEXIST') throw new VaultError('conflict', 'Já existe uma conversão pendente para esta captura; ela será retomada ao reabrir o vault.')
        throw error
      }
      return
    }
    const next = `${path}.next-${randomUUID()}`
    await writeExclusiveSynced(next, bytes)
    await rename(next, path)
  }

  async convert(captureId: string, captureRevision: string, outputs: OutputSpec[], hooks: TransactionHooks = {}): Promise<{ primaryId: string; ids: string[] }> {
    const capture = this.repo.get(captureId)
    if (!capture || capture.kind !== 'capture') throw new VaultError('not-found', 'Captura não encontrada.')
    if (capture.snapshot.revision !== captureRevision) throw new VaultError('conflict', 'A captura mudou desde que foi aberta.')
    if (capture.snapshot.metadata.status !== 'pending') throw new VaultError('invalid', 'Só capturas pendentes podem ser processadas; uma captura convertida não é convertida de novo.')
    if (outputs.length === 0) throw new VaultError('invalid', 'Escolha um resultado principal.')

    // Gerar IDs e conteúdo antes do INIT, para que os hashes sejam conhecidos. O marcador PRIMARY em
    // project_id/context_item_id aponta para o resultado principal (ex.: tarefas derivadas de um projeto).
    const primaryId = randomUUID()
    const pending = new Map<string, { kind: EntityKind; metadata: Record<string, unknown> }>()
    const prepared = outputs.map((spec, index) => {
      const id = index === 0 ? primaryId : randomUUID()
      const input: Record<string, unknown> = { ...spec.input, origin_capture_id: captureId }
      for (const field of ['project_id', 'context_item_id']) if (input[field] === PRIMARY) input[field] = primaryId
      const p = this.repo.prepareNew(spec.kind, input, spec.body, id, pending)
      pending.set(id, { kind: spec.kind, metadata: p.metadata })
      const folder = p.relPath.slice(0, p.relPath.lastIndexOf('/'))
      return { spec, ...p, tmpRel: `${folder}/.tmp-${randomUUID()}.md` }
    })
    const primary = prepared[0]!
    const primaryType: ConversionType = primary.spec.kind === 'item' ? (primary.metadata.type as ConversionType) : primary.spec.kind
    for (const p of prepared) await mkdir(this.repo.abs(p.relPath.slice(0, p.relPath.lastIndexOf('/'))), { recursive: true })

    const manifest: Manifest = {
      schema_version: 1,
      capture_id: captureId,
      stage: 'INIT',
      primary_type: primaryType,
      primary_id: primaryId,
      outputs: prepared.map((p) => ({ id: p.id, entity_type: p.spec.kind, file: p.relPath, tmp_file: p.tmpRel, sha256: sha256(p.bytes) })),
      created_at: this.clock().toISOString()
    }
    await this.writeManifest(manifest, true)
    await hooks.after?.('INIT')

    for (const p of prepared) {
      await writeExclusiveSynced(this.repo.abs(p.tmpRel), p.bytes)
      if ((await hashOf(this.repo.abs(p.tmpRel))) !== sha256(p.bytes)) throw new VaultError('uncertain', 'Temporário gravado não confere; a conversão será retomada ao reabrir.')
      await hooks.after?.(`TMP:${p.id}`)
    }
    manifest.stage = 'TMP_WRITTEN'
    await this.writeManifest(manifest, false)
    await hooks.after?.('TMP_WRITTEN')

    await this.finish(manifest, hooks)
    return { primaryId, ids: prepared.map((p) => p.id) }
  }

  // Completa a partir de TMP_WRITTEN (ou de onde parou). Idempotente.
  private async finish(manifest: Manifest, hooks: TransactionHooks): Promise<void> {
    for (const output of manifest.outputs) {
      const finalAbs = this.repo.abs(output.file)
      const finalHash = await hashOf(finalAbs)
      if (finalHash === output.sha256) {
        if ((await hashOf(this.repo.abs(output.tmp_file))) === output.sha256) await rm(this.repo.abs(output.tmp_file))
        continue
      }
      if (finalHash !== null) throw new VaultError('conflict', `O destino ${output.file} existe com conteúdo diferente; nada foi substituído.`)
      try {
        await promote(this.repo.abs(output.tmp_file), finalAbs)
      } catch (error) {
        if (errno(error) === 'EEXIST') throw new VaultError('conflict', `O destino ${output.file} apareceu durante a conversão; nada foi substituído.`)
        throw error
      }
      await hooks.after?.(`RENAMED:${output.id}`)
    }
    if (manifest.stage !== 'FILES_RENAMED' && manifest.stage !== 'INBOX_UPDATED') {
      manifest.stage = 'FILES_RENAMED'
      await this.writeManifest(manifest, false)
      await hooks.after?.('FILES_RENAMED')
    }

    await this.repo.load()
    const capture = this.repo.get(manifest.capture_id)
    if (!capture) throw new VaultError('not-found', 'A captura de origem não foi encontrada; o manifesto foi mantido para diagnóstico.')
    const meta = capture.snapshot.metadata
    if (meta.status === 'pending') {
      await this.repo.update(manifest.capture_id, capture.snapshot.revision, {
        ...meta,
        status: 'processed',
        processed_at: this.clock().toISOString(),
        converted_to_type: manifest.primary_type,
        converted_to_id: manifest.primary_id
      })
      await hooks.after?.('CAPTURE_UPDATED')
    } else if (meta.converted_to_id !== manifest.primary_id) {
      throw new VaultError('conflict', 'A captura já registra outro resultado; o manifesto foi mantido para diagnóstico.')
    }
    if (manifest.stage !== 'INBOX_UPDATED') {
      manifest.stage = 'INBOX_UPDATED'
      await this.writeManifest(manifest, false)
      await hooks.after?.('INBOX_UPDATED')
    }
    await rm(this.repo.abs(manifestPath(manifest.capture_id)))
    await this.repo.load()
  }

  private parse(relPath: string, raw: string): Manifest {
    const value = JSON.parse(raw) as Partial<Manifest>
    const fileId = /\.txn_([0-9a-f-]{36})\.json$/.exec(relPath)?.[1]
    const stages: Stage[] = ['INIT', 'TMP_WRITTEN', 'FILES_RENAMED', 'INBOX_UPDATED']
    if (value.schema_version !== 1) throw new Error('versão de manifesto não suportada')
    if (!isUuid(value.capture_id) || value.capture_id !== fileId) throw new Error('capture_id inválido')
    if (!stages.includes(value.stage as Stage)) throw new Error('etapa inválida')
    if (!isUuid(value.primary_id) || !Array.isArray(value.outputs) || value.outputs.length === 0) throw new Error('resultados inválidos')
    for (const o of value.outputs) {
      if (!isUuid(o.id) || !allowedFile.test(o.file) || !o.file.endsWith(`/${o.id}.md`) || !allowedTmp.test(o.tmp_file) || !/^[0-9a-f]{64}$/.test(o.sha256)) throw new Error(`resultado inválido: ${String(o.file)}`)
    }
    if (value.outputs[0]!.id !== value.primary_id) throw new Error('resultado principal inconsistente')
    return value as Manifest
  }

  // Recuperação no arranque (VAULT_CONTRACT §4). Valida tudo antes de tocar em arquivos.
  async recoverAll(relPaths: readonly string[], hooks: TransactionHooks = {}): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = []
    for (const relPath of relPaths) {
      let manifest: Manifest
      try {
        manifest = this.parse(relPath, await readFile(this.repo.abs(relPath), 'utf8'))
      } catch (error) {
        results.push({ manifest: relPath, captureId: '', outcome: 'blocked', message: `Manifesto inválido mantido para diagnóstico: ${(error as Error).message}` })
        continue
      }
      try {
        const states = await Promise.all(manifest.outputs.map(async (o) => ({ o, final: await hashOf(this.repo.abs(o.file)), tmp: await hashOf(this.repo.abs(o.tmp_file)) })))
        const missing = states.filter((s) => s.final !== s.o.sha256 && s.tmp !== s.o.sha256)
        if (missing.length > 0 && states.every((s) => s.final === null)) {
          // D-023: nenhum resultado final foi promovido e faltam temporários; a conversão é descartada,
          // a captura continua pendente e só os temporários comprovadamente desta transação são removidos.
          for (const s of states) if (s.tmp === s.o.sha256) await rm(this.repo.abs(s.o.tmp_file))
          await rm(this.repo.abs(relPath))
          results.push({ manifest: relPath, captureId: manifest.capture_id, outcome: 'discarded', message: 'Conversão interrompida antes de gravar resultados; a captura continua pendente.' })
          continue
        }
        if (missing.length > 0) {
          const conflict = missing.find((s) => s.final !== null)
          results.push({
            manifest: relPath, captureId: manifest.capture_id, outcome: 'blocked',
            message: conflict ? `O destino ${conflict.o.file} tem conteúdo diferente do esperado; nada foi substituído.` : `Dados necessários ausentes (${missing.map((s) => s.o.file).join(', ')}); a captura continua pendente e o manifesto foi mantido.`
          })
          continue
        }
        await this.finish(manifest, hooks)
        results.push({ manifest: relPath, captureId: manifest.capture_id, outcome: 'completed', message: 'Conversão retomada e concluída.' })
      } catch (error) {
        results.push({ manifest: relPath, captureId: manifest.capture_id, outcome: 'blocked', message: (error as Error).message })
      }
    }
    return results
  }
}
