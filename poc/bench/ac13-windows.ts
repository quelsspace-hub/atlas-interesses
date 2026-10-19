import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { appendFile, mkdir, mkdtemp, open, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { release, tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { generateFixture } from './ac19-fixture.js'
import { exportBackup } from '../src/backup/export.js'
import type { ManifestFile } from '../src/backup/manifest.js'

// AC-13, parte Windows: extrai backups do exportador com os componentes do sistema e confere bytes contra o manifesto.
// Não altera o exportador. Uso: node dist/bench/ac13-windows.js novo-resultado.jsonl [--heavy]
const args = process.argv.slice(2)
const heavy = args.includes('--heavy')
const out = args.find((arg) => !arg.startsWith('--'))
if (!out || args.length !== (heavy ? 2 : 1)) throw new Error('usage: node dist/bench/ac13-windows.js new-results.jsonl [--heavy]')
if (process.platform !== 'win32') throw new Error('AC-13 Windows: execute no Windows 11')

const NOW = new Date('2026-10-18T12:00:00.000Z')
const TAG_ID = '22222222-2222-4222-8222-222222222222'
const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
const powershell = join(system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const tar = join(system32, 'tar.exe')

function run(file: string, argv: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string; elapsedMs: number }> {
  const started = performance.now()
  return new Promise((resolve) => {
    execFile(file, argv, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : null) : 0
      resolve({ code, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000), elapsedMs: Math.round(performance.now() - started) })
    })
  })
}

const ps = (script: string, timeoutMs: number) => run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], timeoutMs)
const quote = (path: string) => `'${path.replace(/'/g, "''")}'`

// Shell.Application (zipfldr) copia de forma assíncrona; o script espera a contagem de arquivos estabilizar.
const extractors: Record<string, (zip: string, dest: string, expected: number, timeoutMs: number) => ReturnType<typeof run>> = {
  'Expand-Archive': (zip, dest, _expected, timeoutMs) => ps(`$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(dest)}`, timeoutMs),
  'tar.exe': (zip, dest, _expected, timeoutMs) => run(tar, ['-xf', zip, '-C', dest], timeoutMs),
  'Shell.Application': (zip, dest, expected, timeoutMs) => ps([
    "$ErrorActionPreference='Stop'",
    '$shell = New-Object -ComObject Shell.Application',
    `$source = $shell.NameSpace(${quote(zip)})`,
    `$target = $shell.NameSpace(${quote(dest)})`,
    "if ($null -eq $source -or $null -eq $target) { throw 'NameSpace indisponível' }",
    '$target.CopyHere($source.Items(), 4 + 16 + 512 + 1024)',
    "$last = ''; $stable = 0",
    `while ($stable -lt 5) { Start-Sleep -Milliseconds 1000; $f = @(Get-ChildItem -LiteralPath ${quote(dest)} -Recurse -File -Force); $n = $f.Count; $b = ($f | Measure-Object -Property Length -Sum).Sum; $key = "$n/$b"; if ($key -eq $last -and $n -ge ${expected}) { $stable++ } elseif ($key -eq $last) { $stable += 0.2 } else { $stable = 0 }; $last = $key }`,
    'Write-Output "files/bytes=$last"'
  ].join('; '), timeoutMs)
}

async function digest(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function listFiles(root: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) found.push(relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
  }
  return found.sort()
}

// Compara a árvore extraída com o manifesto: mesmos caminhos (mais o próprio manifest.json), tamanhos e SHA-256.
async function compare(dest: string, files: ManifestFile[]) {
  const present = await listFiles(dest)
  const expected = new Set([...files.map((file) => file.path), 'manifest.json'])
  const missing = [...expected].filter((path) => !present.includes(path))
  const unexpected = present.filter((path) => !expected.has(path))
  const mismatched: string[] = []
  let verified = 0
  for (const file of files) {
    if (missing.includes(file.path)) continue
    const path = join(dest, ...file.path.split('/'))
    if ((await stat(path)).size !== file.size || (await digest(path)) !== file.sha256) mismatched.push(file.path)
    else verified++
  }
  return { present: present.length, verified, missing: missing.slice(0, 10), missingCount: missing.length, unexpected: unexpected.slice(0, 10), mismatched: mismatched.slice(0, 10), mismatchedCount: mismatched.length }
}

async function smallVault(root: string): Promise<void> {
  await mkdir(join(root, 'tags'), { recursive: true })
  await writeFile(join(root, 'tags', `${TAG_ID}.md`), `---\nid: ${TAG_ID}\nschema_version: 1\ntitle: Base\n---\nTag.\n`, { flag: 'wx' })
  await mkdir(join(root, 'assets', 'sub'), { recursive: true })
  await writeFile(join(root, 'assets', 'sub', 'dados.bin'), Buffer.from(Array.from({ length: 70_000 }, (_, index) => (index * 7) % 256)), { flag: 'wx' })
  // Nome não ASCII: exercita a flag UTF-8 (bit 11) nos extratores do sistema.
  await writeFile(join(root, 'assets', 'sub', 'ação-çã.bin'), Buffer.from('conteúdo não ASCII\n'), { flag: 'wx' })
  await writeFile(join(root, 'settings.yml'), 'settings_version: 1\n', { flag: 'wx' })
}

await writeFile(out, `${JSON.stringify({ type: 'environment', node: process.version, platform: process.platform, osRelease: release(), arch: process.arch, heavy })}\n`, { flag: 'wx' })
const work = await mkdtemp(join(tmpdir(), 'atlas-ac13-win-'))
let failures = 0
try {
  const cases: Array<{ name: string; build: (vault: string) => Promise<void>; forceZip64: boolean; timeoutMs: number }> = [
    { name: 'classico', build: smallVault, forceZip64: false, timeoutMs: 120_000 },
    { name: 'zip64-forcado', build: smallVault, forceZip64: true, timeoutMs: 120_000 }
  ]
  if (heavy) {
    cases.push({ name: 'zip64-65539-entradas', build: (vault) => generateFixture(vault, { series: 'ii', step: 65_536 }), forceZip64: false, timeoutMs: 3_600_000 })
    cases.push({
      name: 'zip64-arquivo-4gib', forceZip64: false, timeoutMs: 3_600_000,
      build: async (vault) => {
        await generateFixture(vault, { series: 'ii', step: 0 })
        await mkdir(join(vault, 'assets'))
        const handle = await open(join(vault, 'assets', 'large.bin'), 'wx')
        try { await handle.truncate(2 ** 32 + 1) } finally { await handle.close() }
      }
    })
  }
  for (const spec of cases) {
    const base = join(work, spec.name)
    const vault = join(base, 'vault')
    await mkdir(base)
    await spec.build(vault)
    const result = await exportBackup(vault, join(base, `${spec.name}.zip`), { decide: () => ({ nonCanonical: {} }), now: () => NOW, forceZip64: spec.forceZip64 })
    const archiveBytes = (await stat(result.archivePath)).size
    process.stdout.write(`${spec.name}: ${result.manifest.files.length} arquivos, ${archiveBytes} bytes\n`)
    for (const [tool, extract] of Object.entries(extractors)) {
      const dest = join(base, `x-${tool.replace(/[^A-Za-z]/g, '')}`)
      await mkdir(dest)
      const execution = await extract(result.archivePath, dest, result.manifest.files.length + 1, spec.timeoutMs)
      const comparison = await compare(dest, result.manifest.files)
      const passed = execution.code === 0 && comparison.verified === result.manifest.files.length && comparison.missingCount === 0 && comparison.unexpected.length === 0 && comparison.mismatchedCount === 0
      if (!passed) failures++
      await appendFile(out, `${JSON.stringify({ type: 'extraction', case: spec.name, forceZip64: spec.forceZip64, files: result.manifest.files.length, archiveBytes, tool, passed, exitCode: execution.code, elapsedMs: execution.elapsedMs, stderr: execution.stderr || undefined, stdout: execution.stdout.trim() || undefined, ...comparison })}\n`)
      process.stdout.write(`  ${tool}: ${passed ? 'ok' : 'FALHOU'} (${comparison.verified}/${result.manifest.files.length} verificados, ${execution.elapsedMs} ms)\n`)
      await rm(dest, { recursive: true, force: true })
    }
    await rm(base, { recursive: true, force: true })
  }
} finally { await rm(work, { recursive: true, force: true }) }
await appendFile(out, `${JSON.stringify({ type: 'summary', failures })}\n`)
process.exitCode = failures === 0 ? 0 : 1
