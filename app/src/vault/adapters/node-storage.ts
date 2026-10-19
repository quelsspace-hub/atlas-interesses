import { lstat, open, readFile, readdir, rename, rm, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { TemporaryWriteError } from '../core/errors.js'
import type { StoragePathKind, StoragePort } from '../core/storage-port.js'

export class NodeFileStorage implements StoragePort {
  protected openTemporary(path: string): Promise<FileHandle> {
    return open(path, 'wx')
  }

  protected removeOwnedTemporary(path: string): Promise<void> {
    return rm(path, { force: true })
  }

  readFile(path: string): Promise<Buffer> {
    return readFile(path)
  }

  async listMarkdownFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => join(directory, entry.name))
      .sort()
  }

  async pathKind(path: string): Promise<StoragePathKind> {
    try {
      const entry = await lstat(path)
      if (entry.isSymbolicLink()) return 'symlink'
      if (entry.isFile()) return 'file'
      if (entry.isDirectory()) return 'directory'
      return 'other'
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return 'missing'
      }
      throw error
    }
  }

  async writeTemporary(path: string, bytes: Buffer): Promise<void> {
    const handle = await this.openTemporary(path)

    try {
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.close()
    } catch (error) {
      let cleanupError: unknown
      try {
        await handle.close()
      } catch (closeError) {
        cleanupError = closeError
      }
      try {
        await this.removeOwnedTemporary(path)
      } catch (removeError) {
        cleanupError = cleanupError === undefined
          ? removeError
          : new AggregateError([cleanupError, removeError], 'Temporary cleanup failed')
      }
      throw new TemporaryWriteError(path, error, cleanupError)
    }
  }

  createExclusive(path: string, bytes: Buffer): Promise<void> {
    return this.writeTemporary(path, bytes)
  }

  rename(source: string, destination: string): Promise<void> {
    return rename(source, destination)
  }

  remove(path: string): Promise<void> {
    return rm(path, { force: true })
  }
}