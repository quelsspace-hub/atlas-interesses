import { join } from 'node:path'
import { itemBelongsToGroup, type TagMembershipSlice } from './domain-rules.js'
import { readRecord, saveMetadata, type RecordSnapshot } from './record.js'
import type { StoragePort } from './storage-port.js'

export interface ExperimentalVaultDirectories {
  tags: string
  groups: string
  items: string
}

export interface ExperimentalTagGroupIndex {
  readonly tagsById: ReadonlyMap<string, RecordSnapshot['metadata']>
  readonly groupsById: ReadonlyMap<string, RecordSnapshot['metadata']>
  readonly itemsById: ReadonlyMap<string, RecordSnapshot['metadata']>
  readonly itemIdsByGroupId: ReadonlyMap<string, readonly string[]>
}

async function readDirectoryRecords(directory: string, storage: StoragePort): Promise<RecordSnapshot[]> {
  const paths = await storage.listMarkdownFiles(directory)
  const records: RecordSnapshot[] = []
  for (const path of paths) records.push(await readRecord(path, storage))
  return records
}

function tagsForIndex(record: RecordSnapshot): TagMembershipSlice {
  const tagIds = record.metadata.tag_ids
  if (!Array.isArray(tagIds) || !tagIds.every((tagId) => typeof tagId === 'string')) {
    throw new Error(`Experimental index fixture requires a string tag_ids list: ${record.path}`)
  }
  return { tag_ids: tagIds }
}

export async function rebuildTagGroupIndex(
  directories: ExperimentalVaultDirectories,
  storage: StoragePort
): Promise<ExperimentalTagGroupIndex> {
  const tagRecords = await readDirectoryRecords(directories.tags, storage)
  const groupRecords = await readDirectoryRecords(directories.groups, storage)
  const itemRecords = await readDirectoryRecords(directories.items, storage)
  const tagsById = new Map(tagRecords.map((record) => [record.metadata.id, record.metadata]))
  const groupsById = new Map(groupRecords.map((record) => [record.metadata.id, record.metadata]))
  const itemsById = new Map(itemRecords.map((record) => [record.metadata.id, record.metadata]))
  const itemIdsByGroupId = new Map<string, readonly string[]>()

  for (const group of groupRecords) {
    const groupTags = tagsForIndex(group)
    const matchingItemIds = itemRecords
      .filter((item) => itemBelongsToGroup(tagsForIndex(item), groupTags))
      .map((item) => item.metadata.id)
    itemIdsByGroupId.set(group.metadata.id, matchingItemIds)
  }

  return { tagsById, groupsById, itemsById, itemIdsByGroupId }
}

export function entityFilePath(directory: string, id: string): string {
  return join(directory, `${id}.md`)
}

export async function renameTagTitle(
  path: string,
  title: string,
  storage: StoragePort
): Promise<RecordSnapshot> {
  const original = await readRecord(path, storage)
  return saveMetadata(original, { ...original.metadata, title }, storage)
}