import { mkdir, stat, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { restoreBackup } from '../src/backup/restore.js'
import { verifyBackupArchive } from '../src/backup/verify-archive.js'
import { inspectFixture, type FixtureInventory } from './f2-fixture.js'
import { measureEntries, writeExperimentArchive, type CompressionLevel, type Corruption, type EntryMeasurement } from './f2-archive.js'

export interface ExperimentRequest {
  root: string
  work: string
  inventory: FixtureInventory
  level: CompressionLevel
  corruption?: Corruption
}
export interface PhaseMetric { phase: string; ms: number; rss: number; heapUsed: number; external: number; arrayBuffers: number }
export interface ExperimentResult {
  ok: boolean
  rejected: boolean
  rejectionStage?: string
  error?: string
  restoreState?: string
  confirmationCalls: number
  destinationCreated: boolean
  entries: EntryMeasurement[]
  zipBytes: number
  totalMs: number
  maxRssBytes: number
  phases: PhaseMetric[]
  disk: { freeBefore: number; freeAfterZip: number; freeAfterRestore: number; logicalPeakBytes: number }
}

export async function experiment(request: ExperimentRequest): Promise<ExperimentResult> {
  await mkdir(request.work) // somente pasta nova pertencente à execução
  const archive = join(request.work, 'experiment.zip')
  const free = async () => { const s = await statfs(request.work); return s.bavail * s.bsize }
  const result: ExperimentResult = { ok: false, rejected: false, confirmationCalls: 0, destinationCreated: false, entries: [], zipBytes: 0, totalMs: 0, maxRssBytes: 0, phases: [], disk: { freeBefore: await free(), freeAfterZip: 0, freeAfterRestore: 0, logicalPeakBytes: 0 } }
  let stage = 'zip'
  let started = process.hrtime.bigint()
  let current: PhaseMetric | undefined
  let phaseStart = started
  const sample = () => {
    if (!current) return
    const mem = process.memoryUsage()
    for (const key of ['rss', 'heapUsed', 'external', 'arrayBuffers'] as const) current[key] = Math.max(current[key], mem[key])
  }
  const phase = (name: string) => {
    sample()
    if (current) current.ms = Number(process.hrtime.bigint() - phaseStart) / 1e6
    current = { phase: name, ms: 0, rss: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }
    result.phases.push(current)
    phaseStart = process.hrtime.bigint()
    sample()
  }
  const timer = setInterval(sample, 5)
  try {
    phase('zip')
    await writeExperimentArchive(request.root, request.inventory, archive, request.level, request.corruption)
    result.zipBytes = (await stat(archive)).size
    result.disk.freeAfterZip = await free()
    if (!request.corruption) {
      stage = 'entry-measurement'
      phase(stage)
      result.entries = await measureEntries(archive)
      stage = 'verify'
      phase(stage)
      await verifyBackupArchive(archive)
    }
    // ZIPs corrompidos passam pelo mesmo ponto público de entrada da restauração.
    stage = 'restore'
    await mkdir(join(request.work, 'restores'))
    const report = await restoreBackup(archive, {
      parentDirectory: join(request.work, 'restores'), folderName: 'copy',
      appDataDirectory: join(request.work, 'app-data'), activeVaultRoot: request.root,
      confirm: () => { result.confirmationCalls++; return true },
      hooks: { phase: (name) => phase(`restore:${name}`) }
    })
    result.restoreState = report.state
    result.destinationCreated = report.destinationCreated
    result.disk.freeAfterRestore = await free()
    if (request.corruption) {
      result.rejected = report.state === 'failed' && !report.canOpen && !report.destinationCreated && result.confirmationCalls === 0
      result.rejectionStage = report.errors[0]?.stage
      result.error = JSON.stringify(report.errors)
      result.ok = result.rejected
    } else {
      if (report.state !== 'verified' || !report.destination) throw new Error(`restore failed: ${JSON.stringify(report.errors)}`)
      stage = 'content-comparison'
      phase(stage)
      const restored = await inspectFixture(report.destination)
      if (restored.setSha256 !== request.inventory.setSha256) throw new Error('restored content/body inventory differs')
      result.ok = true
    }
    result.disk.logicalPeakBytes = result.zipBytes + (report.destinationCreated ? request.inventory.bytes : 0)
  } catch (error) {
    result.error = `${stage}: ${String(error)}`
    // Uma exceção do laboratório não comprova recusa segura pelo produto.
    result.ok = false
  } finally {
    phase('done')
    result.phases.pop()
    clearInterval(timer)
    result.totalMs = Number(process.hrtime.bigint() - started) / 1e6
    result.maxRssBytes = process.resourceUsage().maxRSS * 1024
  }
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await experiment(JSON.parse(process.argv[2]) as ExperimentRequest)
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (!result.ok) process.exitCode = 1
}
