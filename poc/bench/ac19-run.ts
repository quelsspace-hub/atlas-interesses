import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, stat, statfs } from 'node:fs/promises'
import { cpus, release, tmpdir, totalmem, version as osVersion } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBackupArchive } from '../src/backup/verify-archive.js'
import { FIXTURE_SEED, generateFixture, type Series } from './ac19-fixture.js'
import type { WorkerRequest, WorkerResult } from './ac19-worker.js'

// Orquestrador do AC-19: gera cada degrau no temporário do sistema, executa exportação e restauração
// em processos separados, registra tempo, memória e disco (protocolo MP, TEST_PLAN §12.3) e apaga tudo ao final.
// Uso: node dist/bench/ac19-run.js --series i --steps 1048576,8388608 --runs 5 --out <arquivo.jsonl>
//      node dist/bench/ac19-run.js --summarize <arquivo.jsonl>

const here = dirname(fileURLToPath(import.meta.url))

interface RunRecord {
  run: number
  export: WorkerResult
  restore?: WorkerResult
  zipBytes: number
  freeBefore: number
  freeAfterExport: number
  freeAfterRestore: number
}

interface StepRecord {
  series: Series
  step: number
  seed: string
  fixture: { files: number; bytes: number; largest: number; longestPath: number; maxDepth: number; setSha256: string }
  runs: RunRecord[]
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function free(path: string): Promise<number> {
  const stats = await statfs(path)
  return stats.bavail * stats.bsize
}

async function walk(root: string, prefix = ''): Promise<Array<{ path: string; size: number }>> {
  const files: Array<{ path: string; size: number }> = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await walk(root, path)))
    else files.push({ path, size: (await stat(join(root, path))).size })
  }
  return files
}

function worker(request: WorkerRequest): WorkerResult {
  const child = spawnSync(process.execPath, [join(here, 'ac19-worker.js'), JSON.stringify(request)], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const line = child.stdout.trim().split('\n').pop() ?? ''
  if (child.status !== 0 || !line.startsWith('{')) throw new Error(`worker failed (${child.status}): ${child.stderr}`)
  return JSON.parse(line) as WorkerResult
}

async function measure(series: Series, step: number, runs: number, sampleMs: number): Promise<StepRecord> {
  const work = await mkdtemp(join(tmpdir(), 'atlas-ac19-'))
  try {
    const vault = join(work, 'vault')
    await mkdir(vault)
    await generateFixture(vault, { series, step })
    const files = await walk(vault)
    const record: StepRecord = {
      series,
      step,
      seed: FIXTURE_SEED,
      fixture: {
        files: files.length,
        bytes: files.reduce((sum, file) => sum + file.size, 0),
        largest: Math.max(...files.map((file) => file.size)),
        longestPath: Math.max(...files.map((file) => Buffer.byteLength(file.path))),
        maxDepth: Math.max(...files.map((file) => file.path.split('/').length)),
        setSha256: ''
      },
      runs: []
    }
    for (const folder of ['out', 'restores', 'app-data']) await mkdir(join(work, folder))
    for (let run = 1; run <= runs; run += 1) {
      const archive = join(work, 'out', `run-${run}.zip`)
      const freeBefore = await free(work)
      const exported = worker({ op: 'export', vault, archive, sampleMs })
      const freeAfterExport = await free(work)
      const entry: RunRecord = { run, export: exported, zipBytes: 0, freeBefore, freeAfterExport, freeAfterRestore: freeAfterExport }
      if (exported.ok) {
        entry.zipBytes = (await stat(archive)).size
        if (record.fixture.setSha256 === '') {
          const manifest = await verifyBackupArchive(archive)
          record.fixture.setSha256 = createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex')
        }
        entry.restore = worker({ op: 'restore', vault, archive, parent: join(work, 'restores'), folder: `run-${run}`, appData: join(work, 'app-data'), sampleMs })
        entry.freeAfterRestore = await free(work)
      }
      record.runs.push(entry)
      await rm(archive, { force: true })
      await rm(join(work, 'restores', `run-${run}`), { recursive: true, force: true })
      process.stderr.write(`series ${series} step ${step} run ${run}: export ${exported.ok ? Math.round(exported.totalMs) + ' ms' : exported.error} restore ${entry.restore ? (entry.restore.ok ? Math.round(entry.restore.totalMs) + ' ms' : entry.restore.state + ' ' + entry.restore.error) : '-'}\n`)
    }
    return record
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

const MiB = 1024 * 1024
const fmtMiB = (bytes: number) => (bytes / MiB).toFixed(1)
const fmtMs = (ms: number) => (ms >= 10000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms')

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function stepLabel(record: StepRecord): string {
  return record.series === 'ii' ? `${record.step} arquivos` : `${fmtMiB(record.step)} MiB`
}

// Resumo: primeira execução separada; mediana e máximo das execuções seguintes (MP item 6).
function summarize(records: StepRecord[]): string {
  const lines: string[] = []
  for (const op of ['export', 'restore'] as const) {
    lines.push(`\n#### ${op === 'export' ? 'Exportação' : 'Restauração'}\n`)
    lines.push('| Série | Degrau | Arquivos | Bytes (MiB) | Tempo 1.ª | Tempo mediana (máx.) seguintes | maxRSS 1.ª (MiB) | maxRSS mediana (máx.) seguintes (MiB) | Fases: pico de RSS amostrado, mediana das seguintes (MiB) | Fases: tempo, mediana das seguintes |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const record of records) {
      const results = record.runs.map((run) => (op === 'export' ? run.export : run.restore)).filter((value): value is WorkerResult => value !== undefined && value.ok)
      if (results.length === 0) {
        lines.push(`| ${record.series} | ${stepLabel(record)} | ${record.fixture.files} | ${fmtMiB(record.fixture.bytes)} | falhou | — | — | — | — | — |`)
        continue
      }
      const [first, ...rest] = results
      const following = rest.length > 0 ? rest : [first]
      const phaseNames = first.phases.map((phase) => phase.phase)
      const phaseRss = phaseNames.map((name) => `${name} ${fmtMiB(median(following.map((result) => result.phases.find((phase) => phase.phase === name)?.peakRss ?? 0)))}`).join('; ')
      const phaseTime = phaseNames.map((name) => `${name} ${fmtMs(median(following.map((result) => result.phases.find((phase) => phase.phase === name)?.ms ?? 0)))}`).join('; ')
      lines.push(`| ${record.series} | ${stepLabel(record)} | ${record.fixture.files} | ${fmtMiB(record.fixture.bytes)} | ${fmtMs(first.totalMs)} | ${fmtMs(median(following.map((result) => result.totalMs)))} (${fmtMs(Math.max(...following.map((result) => result.totalMs)))}) | ${fmtMiB(first.maxRssBytes)} | ${fmtMiB(median(following.map((result) => result.maxRssBytes)))} (${fmtMiB(Math.max(...following.map((result) => result.maxRssBytes)))}) | ${phaseRss} | ${phaseTime} |`)
    }
  }
  lines.push('\n#### Disco e fixture\n')
  lines.push('| Série | Degrau | Maior arquivo (MiB) | Maior caminho (bytes) | Profundidade | Hash do conjunto (16 primeiros) | ZIP (MiB) | ZIP / bytes incluídos | Execuções com sucesso (exp./rest.) |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const record of records) {
    const zip = record.runs.find((run) => run.zipBytes > 0)?.zipBytes ?? 0
    const ok = `${record.runs.filter((run) => run.export.ok).length}/${record.runs.filter((run) => run.restore?.ok).length} de ${record.runs.length}`
    lines.push(`| ${record.series} | ${stepLabel(record)} | ${fmtMiB(record.fixture.largest)} | ${record.fixture.longestPath} | ${record.fixture.maxDepth} | ${record.fixture.setSha256.slice(0, 16)} | ${fmtMiB(zip)} | ${zip ? (zip / record.fixture.bytes).toFixed(4) : '—'} | ${ok} |`)
  }
  return lines.join('\n')
}

async function environment(): Promise<Record<string, unknown>> {
  const versionOf = async (name: string) => (JSON.parse(await readFile(join(here, '..', '..', 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version
  return {
    type: 'environment',
    node: process.version,
    os: osVersion(),
    release: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemBytes: totalmem(),
    yauzl: await versionOf('yauzl'),
    yazl: await versionOf('yazl'),
    startedAt: new Date().toISOString()
  }
}

async function main(): Promise<void> {
  const summaryFile = argument('summarize')
  if (summaryFile) {
    const records = (await readFile(summaryFile, 'utf8')).split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as StepRecord & { type?: string }).filter((record) => record.type !== 'environment')
    process.stdout.write(`${summarize(records)}\n`)
    return
  }
  const series = argument('series') as Series
  const steps = (argument('steps') ?? '').split(',').filter(Boolean).map(Number)
  const runs = Number(argument('runs') ?? '5')
  const sampleMs = Number(argument('sample') ?? '5')
  const out = argument('out')
  if (!['i', 'ii', 'iii'].includes(series) || steps.length === 0 || !out) throw new Error('usage: --series i|ii|iii --steps a,b,c --runs n --out file.jsonl')
  await appendFile(out, `${JSON.stringify({ ...(await environment()), series, steps, runs, sampleMs })}\n`)
  for (const step of steps) {
    const record = await measure(series, step, runs, sampleMs)
    await appendFile(out, `${JSON.stringify(record)}\n`)
  }
}

await main()
