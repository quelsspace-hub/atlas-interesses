import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, mkdtemp, readFile, rm, statfs, writeFile } from 'node:fs/promises'
import { cpus, release, tmpdir, totalmem, version } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateExpansion, generateF2, F2_SEED, type FixtureInventory } from './f2-fixture.js'
import type { CompressionLevel, Corruption } from './f2-archive.js'
import type { ExperimentRequest, ExperimentResult } from './f2-worker.js'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
export interface Scenario {
  type: 'scenario'
  name: string
  level: CompressionLevel
  fixture: FixtureInventory
  corruption?: Corruption
  runs: ExperimentResult[]
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const pair = (values: number[]) => `${median(values).toFixed(2)} / ${Math.max(...values).toFixed(2)}`

export function summarize(scenarios: Scenario[]): string {
  const expected = new Set([
    ...['F-2.v1', 'F-3-expansion-8', 'F-3-expansion-32'].flatMap((name) => [0, 1, 6, 9].map((level) => `${name}/${level}`)),
    ...['size', 'hash', 'truncated'].map((name) => `F-3-${name}/6`)
  ])
  if (scenarios.length !== expected.size) throw new Error('incomplete experiment: expected 15 scenarios')
  for (const scenario of scenarios) {
    if (!expected.delete(`${scenario.name}/${scenario.level}`)) throw new Error('duplicate or unexpected scenario')
    if (scenario.runs.length !== 5 || scenario.runs.some((r) => !r.ok)) throw new Error('incomplete or failed scenario')
    const corrupt = scenario.name.startsWith('F-3-') && !scenario.name.startsWith('F-3-expansion')
    if (scenario.runs.some((r) => corrupt
      ? !r.rejected || r.rejectionStage !== 'pre-validation' || r.destinationCreated || r.confirmationCalls !== 0
      : r.restoreState !== 'verified')) throw new Error('unexpected operation outcome')
  }
  const lines = ['# Medições F-2.v1 / F-3 — S-1', '', 'Resultados de um ambiente. Primeira execução separada; cache frio não comprovado. Mediana/máximo das execuções 2–5. Tempos incluem sondas e comparação de hashes.', '', '| Cenário | Nível (0=store) | Sucessos | Tempo 1 (ms) | Tempo seguintes med/máx (ms) | maxRSS seguintes med/máx (MiB) | ZIP (bytes) |', '| --- | --- | --- | --- | --- | --- | --- |']
  for (const scenario of scenarios) {
    if (scenario.runs.length < 5) throw new Error('incomplete scenario')
    const [first, ...rest] = scenario.runs
    lines.push(`| ${scenario.name} | ${scenario.level} | ${scenario.runs.filter((r) => r.ok).length}/${scenario.runs.length} | ${first.totalMs.toFixed(2)} | ${pair(rest.map((r) => r.totalMs))} | ${pair(rest.map((r) => r.maxRssBytes / 1048576))} | ${first.zipBytes} |`)
  }
  lines.push('', '## Razões por nível', '', '| Nível | Maior razão legítima (inclui manifesto) | Menor razão dos payloads F-3 de expansão | Zero 8 MiB legítimo = F-3 (hash, U, C, método) |', '| --- | --- | --- | --- |')
  for (const level of [0, 1, 6, 9]) {
    const f2 = scenarios.find((s) => s.name === 'F-2.v1' && s.level === level)
    const expansion = scenarios.filter((s) => s.name.startsWith('F-3-expansion') && s.level === level)
    if (!f2 || expansion.length !== 2) throw new Error('missing ratio scenarios')
    const legitimate = f2.runs.flatMap((r) => r.entries).filter((e) => e.ratio !== null)
    const adversarial = expansion.flatMap((s) => s.runs.flatMap((r) => r.entries.filter((e) => e.path.startsWith('assets/'))))
    const zero = legitimate.find((e) => e.path === 'assets/zeros-8388608.bin')
    if (!zero || adversarial.length === 0) throw new Error('missing matched bytes')
    const same = adversarial.every((e) => e.sha256 === zero.sha256 && e.uncompressed === zero.uncompressed && e.compressed === zero.compressed && e.method === zero.method)
    const maxLegitimate = Math.max(...legitimate.map((e) => e.ratio!))
    const minExpansion = Math.min(...adversarial.map((e) => e.ratio!))
    lines.push(`| ${level} | ${maxLegitimate.toFixed(6)} | ${minExpansion.toFixed(6)} | ${same ? 'sim' : 'não'} |`)
  }
  lines.push('', '## Fases (execuções 2–5)', '', '| Cenário / nível | Fase | Tempo med/máx (ms) | RSS amostrado med/máx (MiB) |', '| --- | --- | --- | --- |')
  for (const scenario of scenarios) {
    const rest = scenario.runs.slice(1)
    const names = [...new Set(rest.flatMap((r) => r.phases.map((p) => p.phase)))]
    for (const name of names) {
      const phases = rest.flatMap((r) => r.phases.filter((p) => p.phase === name))
      lines.push(`| ${scenario.name} / ${scenario.level} | ${name} | ${pair(phases.map((p) => p.ms))} | ${pair(phases.map((p) => p.rss / 1048576))} |`)
    }
  }
  lines.push('', 'Dados brutos incluem inventários completos, hashes dos corpos, U/C/bytes reais/SHA-256 por entrada, fases, memória e espaço livre. As sondas de disco refletem também atividade externa; logicalPeakBytes contabiliza ZIP + cópia restaurada, sem diário/metadados do filesystem. O corpus fonte é adicional. External e arrayBuffers são registrados separadamente, sem somá-los.', '', 'Os resultados não aprovam AC-07, TC-21, compatibilidade Windows ou metas Q-07. Se as razões legítimas e de expansão se sobrepõem, o critério vigente não fornece intervalo para S-1; a proprietária deve decidir a revisão do critério antes de implementar um valor.')
  return `${lines.join('\n')}\n`
}

async function sourceIdentity(): Promise<Record<string, string>> {
  const result = spawnSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: repo, encoding: 'utf8' })
  if (result.status !== 0) throw new Error('cannot identify source inputs')
  const names = [...new Set(result.stdout.trim().split('\n'))].filter((p) => p.startsWith('poc/') && (/\.ts$/.test(p) || /(?:package(?:-lock)?|tsconfig)\.json$/.test(p))).sort()
  const hashes: Record<string, string> = {}
  for (const name of names) hashes[name] = createHash('sha256').update(await readFile(join(repo, name))).digest('hex')
  return hashes
}

async function main(): Promise<void> {
  if (process.argv[2] === '--summarize' && process.argv.length === 4) {
    const records = (await readFile(process.argv[3], 'utf8')).trim().split('\n').map((line) => JSON.parse(line))
    if (records.some((r) => r.type === 'worker-failure') || records.filter((r) => r.type === 'run').length !== 75) throw new Error('incomplete or failed run ledger')
    process.stdout.write(summarize(records.filter((r) => r.type === 'scenario') as Scenario[]))
    return
  }
  if (process.argv[2] !== '--out' || process.argv.length !== 4) throw new Error('usage: --out new-file.jsonl | --summarize file.jsonl')
  const out = resolve(process.argv[3])
  await mkdir(dirname(out), { recursive: true })
  const work = await mkdtemp(join(tmpdir(), 'atlas-f2-'))
  try {
    const disk = await statfs(work)
    if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error('laboratory requires 2 GiB free; not a product limit')
    const pkg = async (name: string) => JSON.parse(await readFile(join(repo, 'poc/node_modules', name, 'package.json'), 'utf8')).version as string
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' })
    if (revision.status !== 0) throw new Error('cannot identify revision')
    await writeFile(out, `${JSON.stringify({ type: 'environment', startedAt: new Date().toISOString(), seed: F2_SEED, node: process.version, zlib: process.versions.zlib, openssl: process.versions.openssl, yauzl: await pkg('yauzl'), yazl: await pkg('yazl'), yaml: await pkg('yaml'), os: version(), release: release(), platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model, logicalCpus: cpus().length, ram: totalmem(), filesystemType: disk.type, revision: revision.stdout.trim(), sourceHashes: await sourceIdentity(), cache: 'not controlled', antivirus: 'not measured', power: 'cloud sandbox; not measured', runs: 5, sampleMs: 5, workerTimeoutMs: 120000, laboratoryFreeSpaceRequired: 2 * 1024 ** 3 })}\n`, { flag: 'wx' })
    const roots = { f2: join(work, 'f2'), duplicate: join(work, 'duplicate'), eight: join(work, 'eight'), thirtyTwo: join(work, 'thirty-two') }
    const f2 = await generateF2(roots.f2)
    const duplicate = await generateF2(roots.duplicate)
    if (JSON.stringify(f2) !== JSON.stringify(duplicate)) throw new Error('F-2.v1 is not reproducible')
    await appendFile(out, `${JSON.stringify({ type: 'reproducibility', equal: true, fixture: f2 })}\n`)
    await rm(roots.duplicate, { recursive: true })
    const eight = await generateExpansion(roots.eight, 8)
    const thirtyTwo = await generateExpansion(roots.thirtyTwo, 32)
    const scenarios: Array<{ name: string; root: string; fixture: FixtureInventory; corruption?: Corruption; levels: CompressionLevel[] }> = [
      { name: 'F-2.v1', root: roots.f2, fixture: f2, levels: [0, 1, 6, 9] },
      { name: 'F-3-expansion-8', root: roots.eight, fixture: eight, levels: [0, 1, 6, 9] },
      { name: 'F-3-expansion-32', root: roots.thirtyTwo, fixture: thirtyTwo, levels: [0, 1, 6, 9] },
      ...(['size', 'hash', 'truncated'] as const).map((corruption) => ({ name: `F-3-${corruption}`, root: roots.eight, fixture: eight, corruption, levels: [6 as const] }))
    ]
    let index = 0
    for (const scenario of scenarios) for (const level of scenario.levels) {
      const record: Scenario = { type: 'scenario', name: scenario.name, level, fixture: scenario.fixture, corruption: scenario.corruption, runs: [] }
      for (let run = 1; run <= 5; run++) {
        const runWork = join(work, `run-${index++}`)
        const request: ExperimentRequest = { root: scenario.root, work: runWork, inventory: scenario.fixture, level, corruption: scenario.corruption }
        const child = spawnSync(process.execPath, [join(here, 'f2-worker.js'), JSON.stringify(request)], { encoding: 'utf8', maxBuffer: 16 * 1024 ** 2, timeout: 120000 })
        const lastLine = child.stdout?.trim().split('\n').pop()
        if (!lastLine) {
          await appendFile(out, `${JSON.stringify({ type: 'worker-failure', scenario: scenario.name, level, run, status: child.status, error: String(child.error ?? child.stderr) })}\n`)
          throw new Error(`worker failed: ${scenario.name}/${level}/${run}`)
        }
        const result = JSON.parse(lastLine) as ExperimentResult
        record.runs.push(result)
        // Checkpoint antes de qualquer limpeza/falha; resultados incompletos não somem.
        await appendFile(out, `${JSON.stringify({ type: 'run', scenario: scenario.name, level, run, result })}\n`)
        process.stderr.write(`${scenario.name} level ${level} run ${run}: ${result.ok ? 'OK' : 'FAILED'} ${result.totalMs.toFixed(1)} ms\n`)
        await rm(runWork, { recursive: true, force: true })
        if (child.status !== 0 || !result.ok) throw new Error(`experiment failed: ${result.error}`)
      }
      await appendFile(out, `${JSON.stringify(record)}\n`)
    }
  } finally { await rm(work, { recursive: true, force: true }) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
