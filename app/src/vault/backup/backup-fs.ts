import { createReadStream, type BigIntStats, type Dirent } from 'node:fs'
import { link, lstat, mkdir, open, readdir, readFile, realpath, rmdir, statfs, unlink, type FileHandle } from 'node:fs/promises'
import type { Readable, Writable } from 'node:stream'

// Porta de arquivos do backup; testes estendem a classe para injetar falhas.
export class BackupFileSystem {
  readdir(path: string): Promise<Dirent[]> {
    return readdir(path, { withFileTypes: true })
  }

  lstat(path: string): Promise<BigIntStats> {
    return lstat(path, { bigint: true })
  }

  realpath(path: string): Promise<string> {
    return realpath(path)
  }

  readFile(path: string): Promise<Buffer> {
    return readFile(path)
  }

  createReadStream(path: string): Readable {
    return createReadStream(path)
  }

  openExclusive(path: string): Promise<FileHandle> {
    return open(path, 'wx')
  }

  // O stream fecha o handle ao terminar; flush faz fsync antes do fechamento.
  createTempWriteStream(handle: FileHandle): Writable {
    return handle.createWriteStream({ autoClose: true, flush: true })
  }

  link(existingPath: string, newPath: string): Promise<void> {
    return link(existingPath, newPath)
  }

  unlink(path: string): Promise<void> {
    return unlink(path)
  }

  // Cria um único diretório; falha com EEXIST se já existir.
  mkdirExclusive(path: string): Promise<void> {
    return mkdir(path).then(() => undefined)
  }

  // Remove só diretório vazio; nunca remove conteúdo.
  rmdir(path: string): Promise<void> {
    return rmdir(path)
  }

  async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true })
  }

  async freeSpace(path: string): Promise<bigint> {
    const stats = await statfs(path, { bigint: true })
    return stats.bavail * stats.bsize
  }

  // Grava uma linha do diário e faz fsync antes de prosseguir.
  async journalAppend(handle: FileHandle, line: string): Promise<void> {
    await handle.write(line)
    await handle.sync()
  }
}

export function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
