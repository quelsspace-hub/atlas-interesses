import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { FrontmatterDiagnosticError, RecordValidationError } from '../src/core/errors.js'
import { parseRecordBytes, validateReducedEnvelope } from '../src/core/frontmatter.js'

const validFixtureUrl = new URL('../../test/fixtures/group.md', import.meta.url)

test('lê o envelope experimental e mantém o corpo como bytes', async () => {
  const bytes = await readFile(validFixtureUrl)
  const parsed = parseRecordBytes(bytes)

  assert.equal(parsed.metadata.id, '123e4567-e89b-42d3-a456-426614174000')
  assert.equal(parsed.metadata.title, 'Grupo sintético')
  assert.equal(validateReducedEnvelope(parsed.metadata).sort_order, 0)
  assert.ok(parsed.body.includes(Buffer.from('ação, coração.', 'utf8')))
})

test('diagnostica YAML inválido sem tentar corrigir o arquivo', () => {
  const bytes = Buffer.from('---\nid: [\n---\ncorpo', 'utf8')
  assert.throws(() => parseRecordBytes(bytes), FrontmatterDiagnosticError)
})

test('rejeita chaves YAML duplicadas', () => {
  const bytes = Buffer.from(
    '---\nid: 123e4567-e89b-42d3-a456-426614174000\ntitle: Primeiro\ntitle: Segundo\nsort_order: 0\n---\ncorpo',
    'utf8'
  )
  assert.throws(
    () => parseRecordBytes(bytes),
    (error: unknown) => error instanceof FrontmatterDiagnosticError && error.diagnostics.join(' ').includes('DUPLICATE_KEY')
  )
})

test('rejeita envelope experimental sem sort_order inteiro', async () => {
  const bytes = await readFile(validFixtureUrl)
  const invalid = Buffer.from(bytes.toString('utf8').replace('sort_order: 0', 'sort_order: 0.5'), 'utf8')
  assert.throws(() => validateReducedEnvelope(parseRecordBytes(invalid).metadata), RecordValidationError)
})

test('leitura genérica preserva ausência de sort_order sem sintetizar valor', () => {
  const bytes = Buffer.from(
    '---\nid: 123e4567-e89b-42d3-a456-426614174001\ntitle: Tag sintética\n---\ncorpo',
    'utf8'
  )
  const parsed = parseRecordBytes(bytes)

  assert.equal(Object.hasOwn(parsed.metadata, 'sort_order'), false)
})