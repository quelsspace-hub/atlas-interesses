export type StoragePathKind = 'file' | 'directory' | 'symlink' | 'other' | 'missing'

export interface StoragePort {
  readFile(path: string): Promise<Buffer>
  listMarkdownFiles(directory: string): Promise<string[]>
  pathKind(path: string): Promise<StoragePathKind>
  // A rejected temporary write must not remove a path it did not exclusively create.
  writeTemporary(path: string, bytes: Buffer): Promise<void>
  createExclusive(path: string, bytes: Buffer): Promise<void>
  rename(source: string, destination: string): Promise<void>
  remove(path: string): Promise<void>
}