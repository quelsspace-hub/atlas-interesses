import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { stringify } from 'yaml'
import { parseRecordBytes, type RecordMetadata } from '../src/core/frontmatter.js'
import {
  entityFilePath,
  rebuildTagGroupIndex,
  renameTagTitle,
  type ExperimentalVaultDirectories
} from '../src/core/tag-group-index.js'
import { NodeFileStorage } from '../src/adapters/node-storage.js'

const temporaryDirectories: string[] = []
const storage = new NodeFileStorage()
const tagId = '11111111-1111-4111-8111-111111111111'
const secondTagId = '22222222-2222-4222-8222-222222222222'
const firstGroupId = '33333333-3333-4333-8333-333333333333'
const secondGroupId = '44444444-4444-4444-8444-444444444444'
const matchedItemId = '55555555-5555-4555-8555-555555555555'
const unmatchedItemId = '66666666-6666-4666-8666-666666666666'

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function recordBytes(metadata: RecordMetadata, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`---\n${stringify(metadata)}---\n`, 'utf8'), body])
}

async function prepareFixture(): Promise<{
  directories: ExperimentalVaultDirectories
  tagPath: string
  groupPaths: string[]
  itemPaths: string[]
}> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-tag-index-'))
  temporaryDirectories.push(root)
  const directories = {
    tags: join(root, 'tags'),
    groups: join(root, 'groups'),
    items: join(root, 'items')
  }
  await Promise.all(Object.values(directories).map((path) => mkdir(path)))

  const tagPath = entityFilePath(directories.tags, tagId)
  const sameTitleTagPath = entityFilePath(directories.tags, secondTagId)
  const groupPaths = [
    entityFilePath(directories.groups, firstGroupId),
    entityFilePath(directories.groups, secondGroupId)
  ]
  const itemPaths = [
    entityFilePath(directories.items, matchedItemId),
    entityFilePath(directories.items, unmatchedItemId)
  ]
  const tagBody = Buffer.from('# Tag body\n\nDescrição: ação e coração.\n', 'utf8')
  const tag = { id: tagId, title: 'Experiência', description: 'Tag experimental' }
  const sameTitleTag = { id: secondTagId, title: 'Experiência' }
  const groups = [
    { id: firstGroupId, title: 'Design', sort_order: 0, tag_ids: [tagId] },
    { id: secondGroupId, title: 'Produto', sort_order: 1, tag_ids: [tagId] }
  ]
  const items = [
    { id: matchedItemId, title: 'Projeto sintético', tag_ids: [tagId] },
    { id: unmatchedItemId, title: 'Item geral sintético', tag_ids: [secondTagId] }
  ]

  await writeFile(tagPath, recordBytes(tag, tagBody))
  await writeFile(sameTitleTagPath, recordBytes(sameTitleTag, Buffer.from('Outra Tag sintética.\n')))
  await Promise.all(groupPaths.map((path, index) => writeFile(path, recordBytes(groups[index], Buffer.from('Grupo sintético.\n')))))
  await Promise.all(itemPaths.map((path, index) => writeFile(path, recordBytes(items[index], Buffer.from('Item sintético.\n')))))

  return { directories, tagPath, groupPaths, itemPaths }
}

test('renomeia Tag sem regravar consumidores e reconstrói associação OR do disco', async (context) => {
  const fixture = await prepareFixture()
  const tagBefore = await readFile(fixture.tagPath)
  const parsedTagBefore = parseRecordBytes(tagBefore)
  const consumerPaths = [...fixture.groupPaths, ...fixture.itemPaths]
  const consumerBytesBefore = await Promise.all(consumerPaths.map((path) => readFile(path)))
  const consumerHashesBefore = consumerBytesBefore.map(sha256)
  const initialIndex = await rebuildTagGroupIndex(fixture.directories, storage)

  assert.equal(initialIndex.tagsById.get(tagId)?.title, 'Experiência')
  assert.equal(initialIndex.tagsById.get(secondTagId)?.title, 'Experiência')
  assert.deepEqual(initialIndex.itemIdsByGroupId.get(firstGroupId), [matchedItemId])
  assert.deepEqual(initialIndex.itemIdsByGroupId.get(secondGroupId), [matchedItemId])
  assert.equal(initialIndex.itemsById.size, 2)
  assert.equal(initialIndex.itemsById.has(unmatchedItemId), true)

  const previousMaps = {
    tags: initialIndex.tagsById,
    groups: initialIndex.groupsById,
    items: initialIndex.itemsById,
    memberships: initialIndex.itemIdsByGroupId
  }
  const renamed = await renameTagTitle(fixture.tagPath, 'Design de serviços', storage)
  const tagAfter = await readFile(fixture.tagPath)
  const parsedTagAfter = parseRecordBytes(tagAfter)
  const consumerBytesAfter = await Promise.all(consumerPaths.map((path) => readFile(path)))
  const consumerHashesAfter = consumerBytesAfter.map(sha256)
  const rebuiltIndex = await rebuildTagGroupIndex(fixture.directories, storage)

  assert.equal(renamed.path, fixture.tagPath)
  assert.equal(renamed.metadata.id, tagId)
  assert.equal(renamed.metadata.title, 'Design de serviços')
  assert.equal(parsedTagAfter.metadata.id, tagId)
  assert.equal(parsedTagAfter.metadata.title, 'Design de serviços')
  assert.deepEqual(parsedTagAfter.body, parsedTagBefore.body)
  assert.equal(sha256(parsedTagAfter.body), sha256(parsedTagBefore.body))
  assert.deepEqual(consumerBytesAfter, consumerBytesBefore)
  assert.deepEqual(consumerHashesAfter, consumerHashesBefore)

  for (const path of [...consumerPaths, fixture.tagPath]) {
    const metadata = parseRecordBytes(await readFile(path)).metadata
    assert.equal(Object.hasOwn(metadata, 'group_id'), false)
    assert.equal(Object.hasOwn(metadata, 'group_ids'), false)
    assert.equal(Object.hasOwn(metadata, 'item_ids'), false)
  }
  for (const path of [...fixture.groupPaths, ...fixture.itemPaths]) {
    const metadata = parseRecordBytes(await readFile(path)).metadata
    assert.deepEqual(metadata.tag_ids, path === fixture.itemPaths[1] ? [secondTagId] : [tagId])
  }
  assert.equal(Object.hasOwn(parsedTagAfter.metadata, 'aliases'), false)

  assert.notStrictEqual(rebuiltIndex.tagsById, previousMaps.tags)
  assert.notStrictEqual(rebuiltIndex.groupsById, previousMaps.groups)
  assert.notStrictEqual(rebuiltIndex.itemsById, previousMaps.items)
  assert.notStrictEqual(rebuiltIndex.itemIdsByGroupId, previousMaps.memberships)
  assert.equal(rebuiltIndex.tagsById.get(tagId)?.title, 'Design de serviços')
  assert.deepEqual(rebuiltIndex.itemIdsByGroupId.get(firstGroupId), [matchedItemId])
  assert.deepEqual(rebuiltIndex.itemIdsByGroupId.get(secondGroupId), [matchedItemId])
  assert.equal(rebuiltIndex.itemsById.size, 2)
  assert.equal(rebuiltIndex.itemsById.has(unmatchedItemId), true)
  assert.deepEqual(rebuiltIndex.itemsById.get(unmatchedItemId)?.tag_ids, [secondTagId])
  assert.deepEqual(
    await storage.listMarkdownFiles(fixture.directories.items),
    [...fixture.itemPaths].sort()
  )

  context.diagnostic(JSON.stringify({
    tag: { id: tagId, title: rebuiltIndex.tagsById.get(tagId)?.title },
    groups: [firstGroupId, secondGroupId].map((groupId) => ({
      id: groupId,
      itemIds: rebuiltIndex.itemIdsByGroupId.get(groupId)
    })),
    allItemIds: [...rebuiltIndex.itemsById.keys()].sort(),
    consumerHashesUnchanged: consumerHashesAfter.every((hash, index) => hash === consumerHashesBefore[index])
  }))
})