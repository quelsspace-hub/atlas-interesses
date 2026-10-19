import { BackupVerificationError } from './errors.js'

// Política explícita da PoC. O valor padrão depende de decisão; undefined mantém
// o comportamento histórico, sem proteção S-1 (as demais verificações continuam).
export interface CompressionPolicy {
  maxCompressionRatio?: number
}

export function validateCompressionLimit(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new RangeError('maxCompressionRatio must be a safe integer >= 1')
  }
  return value
}

export function checkCompressionRatio(path: string, uncompressed: number, compressed: number, limit: number | undefined): void {
  validateCompressionLimit(limit)
  if (limit === undefined) return
  if (!Number.isSafeInteger(uncompressed) || uncompressed < 0 || !Number.isSafeInteger(compressed) || compressed < 0) {
    throw new BackupVerificationError([{ category: 'security', path, code: 'invalid-entry-size', message: 'ZIP entry sizes must be non-negative safe integers' }])
  }
  // Comparação exata, inclusive para tamanhos ZIP64; nunca multiplicar doubles.
  if (BigInt(uncompressed) > BigInt(compressed) * BigInt(limit)) {
    throw new BackupVerificationError([{
      category: 'security', path, code: 'compression-ratio-exceeded',
      message: `A entrada declara ${uncompressed} bytes para ${compressed} bytes comprimidos e excede o limite ${limit}:1. Um arquivo legítimo também pode exceder esse filtro. Gere um novo backup sem compressão (store) na ferramenta de origem.`
    }])
  }
}
