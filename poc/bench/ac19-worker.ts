import { exportBackup, type ExportDecisions } from '../src/backup/export.js'
import type { VaultInventory } from '../src/backup/inventory.js'
import { restoreBackup } from '../src/backup/restore.js'

// Executa uma única operação medida num processo próprio, para que maxRSS seja o pico desta operação (TEST_PLAN §12.3).
export interface WorkerRequest {
  op: 'export' | 'restore'
  vault: string
  archive: string
  parent?: string
  folder?: string
  appData?: string
  sampleMs: number
}

export interface PhaseMeasurement {
  phase: string
  ms: number
  peakRss: number
  peakHeapUsed: number
  peakExternal: number
  samples: number
}

export interface WorkerResult {
  op: 'export' | 'restore'
  ok: boolean
  state?: string
  error?: string
  totalMs: number
  startRss: number
  maxRssBytes: number
  phases: PhaseMeasurement[]
}

function includeAll(inventory: VaultInventory): ExportDecisions {
  return {
    nonCanonical: Object.fromEntries(inventory.nonCanonical.map((file) => [file.path, 'include' as const])),
    ...(inventory.systemFiles.length > 0 ? { systemFiles: 'include' as const } : {})
  }
}

async function main(): Promise<void> {
  const request = JSON.parse(process.argv[2]) as WorkerRequest
  const phases: PhaseMeasurement[] = []
  let current: PhaseMeasurement | undefined
  let currentStart = 0n

  const sample = () => {
    if (!current) return
    const usage = process.memoryUsage()
    current.peakRss = Math.max(current.peakRss, usage.rss)
    current.peakHeapUsed = Math.max(current.peakHeapUsed, usage.heapUsed)
    current.peakExternal = Math.max(current.peakExternal, usage.external + usage.arrayBuffers)
    current.samples += 1
  }
  const phase = (name: string) => {
    const now = process.hrtime.bigint()
    if (current) {
      sample()
      current.ms = Number(now - currentStart) / 1e6
    }
    current = { phase: name, ms: 0, peakRss: 0, peakHeapUsed: 0, peakExternal: 0, samples: 0 }
    currentStart = now
    phases.push(current)
    sample()
  }

  const startRss = process.memoryUsage().rss
  const timer = setInterval(sample, request.sampleMs)
  const started = process.hrtime.bigint()
  const result: WorkerResult = { op: request.op, ok: false, totalMs: 0, startRss, maxRssBytes: 0, phases }
  try {
    if (request.op === 'export') {
      await exportBackup(request.vault, request.archive, { decide: includeAll, hooks: { phase } })
      result.ok = true
    } else {
      const report = await restoreBackup(request.archive, {
        parentDirectory: request.parent!,
        folderName: request.folder!,
        appDataDirectory: request.appData!,
        activeVaultRoot: request.vault,
        confirm: () => true,
        hooks: { phase }
      })
      result.state = report.state
      result.ok = report.state === 'verified'
      if (!result.ok) result.error = JSON.stringify(report.errors.slice(0, 3))
    }
  } catch (error) {
    result.error = String(error)
  }
  phase('done')
  clearInterval(timer)
  phases.pop()
  result.totalMs = Number(process.hrtime.bigint() - started) / 1e6
  // No Windows, maxRSS é o pico do working set do processo, em KiB.
  result.maxRssBytes = process.resourceUsage().maxRSS * 1024
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

await main()
