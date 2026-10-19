// Manifesto M-B (VAULT_CONTRACT §7.1).
export const MANIFEST_PATH = 'manifest.json'
export const SUPPORTED_MANIFEST_VERSIONS: readonly number[] = [1]

export interface ManifestFile {
  path: string
  size: number
  sha256: string
}

export interface BackupManifest {
  manifest_version: number
  created_at: string
  file_count: number
  files: ManifestFile[]
}

const isoUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/
const sha256Hex = /^[0-9a-f]{64}$/
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

export function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

export function collisionKey(path: string): string {
  return path.normalize('NFC').toLowerCase()
}

export function isWellFormedName(value: string): boolean {
  return !loneSurrogate.test(value)
}

// Limites de segurança decididos pela D-015 (VAULT_CONTRACT §7.5). Comprimentos em unidades UTF-16.
export const PATH_LIMITS = {
  maxPathUnits: 1024,
  maxPathBytes: 3072,
  maxSegmentUnits: 255,
  maxDepth: 32
} as const
const controlCharacter = /[\u0000-\u001F]/

export interface PathLimitProblem {
  code: 'control-character' | 'path-too-long' | 'segment-too-long' | 'path-too-deep' | 'reserved-name'
  message: string
}

// D-019: nomes que o Windows não representa fielmente. Bloqueio de segurança, sem renomear.
const reservedDeviceName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const windowsForbiddenCharacter = /[<>:"|?*]/

export function reservedNameProblem(segment: string): string | null {
  if (reservedDeviceName.test(segment)) return `"${segment}" is a reserved Windows device name`
  if (/[ .]$/.test(segment)) return `"${segment}" ends with a space or a dot`
  if (windowsForbiddenCharacter.test(segment)) return `"${segment}" contains one of <>:"|?*`
  return null
}

// Limites de comprimento, segmento, profundidade e caracteres de controle de um caminho relativo com '/'.
export function pathLimitProblem(path: string): PathLimitProblem | null {
  if (controlCharacter.test(path)) return { code: 'control-character', message: 'control characters U+0000–U+001F are refused in paths' }
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') continue
    const reserved = reservedNameProblem(segment)
    if (reserved) return { code: 'reserved-name', message: `${reserved} (D-019)` }
  }
  if (path.length > PATH_LIMITS.maxPathUnits || Buffer.byteLength(path, 'utf8') > PATH_LIMITS.maxPathBytes) {
    return { code: 'path-too-long', message: `relative path exceeds ${PATH_LIMITS.maxPathUnits} UTF-16 units or ${PATH_LIMITS.maxPathBytes} UTF-8 bytes` }
  }
  const segments = path.split('/')
  if (segments.some((segment) => segment.length > PATH_LIMITS.maxSegmentUnits)) {
    return { code: 'segment-too-long', message: `a path segment exceeds ${PATH_LIMITS.maxSegmentUnits} UTF-16 units` }
  }
  if (segments.length > PATH_LIMITS.maxDepth) return { code: 'path-too-deep', message: `path has more than ${PATH_LIMITS.maxDepth} segments` }
  return null
}

// Teto do tamanho do manifesto serializado para N arquivos (D-015, S-3): cabeçalho + N × (registro + caminho escapado).
export function manifestSizeBound(fileCount: number): number {
  return 256 + fileCount * (150 + 2 * PATH_LIMITS.maxPathBytes)
}

// Regras de caminho do manifesto: relativo, separador '/', sem '.'/'..', sem raiz nem unidade.
export function backupPathProblem(path: string): string | null {
  if (path.length === 0) return 'empty path'
  if (!isWellFormedName(path)) return 'path is not representable in UTF-8'
  if (path.includes('\\')) return 'backslash in path'
  if (path.startsWith('/')) return 'absolute path'
  if (/^[A-Za-z]:/.test(path)) return 'drive letter in path'
  if (path.includes('\0')) return 'NUL in path'
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return `invalid segment "${segment}"`
  }
  return null
}

export function buildManifest(files: readonly ManifestFile[], createdAt: Date): BackupManifest {
  const sorted = [...files].sort((left, right) => compareUtf8(left.path, right.path))
  return {
    manifest_version: 1,
    created_at: createdAt.toISOString(),
    file_count: sorted.length,
    files: sorted.map((file) => ({ path: file.path, size: file.size, sha256: file.sha256 }))
  }
}

export function serializeManifest(manifest: BackupManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export function manifestProblems(value: unknown): string[] {
  const problems: string[] = []
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['manifest must be a JSON object']
  const manifest = value as Record<string, unknown>
  const known = new Set(['manifest_version', 'created_at', 'file_count', 'files'])
  for (const key of Object.keys(manifest)) if (!known.has(key)) problems.push(`unknown manifest key ${key}`)

  if (typeof manifest.manifest_version !== 'number' || !SUPPORTED_MANIFEST_VERSIONS.includes(manifest.manifest_version)) {
    problems.push('unsupported manifest_version')
  }
  if (typeof manifest.created_at !== 'string' || !isoUtc.test(manifest.created_at) || Number.isNaN(Date.parse(manifest.created_at))) {
    problems.push('created_at must be an ISO 8601 UTC timestamp')
  }
  if (!Array.isArray(manifest.files)) return [...problems, 'files must be a list']
  if (manifest.file_count !== manifest.files.length) problems.push('file_count does not match files')

  const keys = new Set<string>()
  let previous: string | undefined
  for (const entry of manifest.files as unknown[]) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push('file entry must be an object')
      continue
    }
    const file = entry as Record<string, unknown>
    if (Object.keys(file).sort().join(',') !== 'path,sha256,size') problems.push('file entry must have exactly path, size and sha256')
    if (typeof file.path !== 'string') {
      problems.push('file path must be a string')
      continue
    }
    const pathProblem = backupPathProblem(file.path)
    if (pathProblem) problems.push(`${file.path}: ${pathProblem}`)
    if (file.path === MANIFEST_PATH) problems.push('manifest lists itself')
    if (previous !== undefined && compareUtf8(previous, file.path) >= 0) problems.push(`${file.path}: files not strictly sorted or duplicated`)
    const key = collisionKey(file.path)
    if (keys.has(key)) problems.push(`${file.path}: duplicate by case or Unicode form`)
    keys.add(key)
    previous = file.path
    if (typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size < 0) problems.push(`${file.path}: invalid size`)
    if (typeof file.sha256 !== 'string' || !sha256Hex.test(file.sha256)) problems.push(`${file.path}: invalid sha256`)
  }
  return problems
}
