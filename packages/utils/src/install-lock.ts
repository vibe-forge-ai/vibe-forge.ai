import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_LOCK_TIMEOUT_MS = 30_000
const DEFAULT_LOCK_RETRY_MS = 100
const LOCK_METADATA_FILENAME = '.vf-lock.json'

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const writeLockMetadata = async (lockDir: string) => {
  await writeFile(
    resolve(lockDir, LOCK_METADATA_FILENAME),
    JSON.stringify({
      createdAt: Date.now(),
      pid: process.pid
    }),
    'utf8'
  )
}

const clearStaleLock = async (lockDir: string, timeoutMs: number) => {
  const lockStat = await stat(lockDir).catch(() => undefined)
  if (lockStat == null) return false

  const metadata = await readFile(resolve(lockDir, LOCK_METADATA_FILENAME), 'utf8')
    .then(content => JSON.parse(content) as { createdAt?: number; pid?: number })
    .catch(() => undefined)
  const createdAt = typeof metadata?.createdAt === 'number' ? metadata.createdAt : lockStat.mtimeMs
  if (Date.now() - createdAt < timeoutMs) {
    return false
  }

  if (typeof metadata?.pid === 'number' && isProcessAlive(metadata.pid)) {
    return false
  }

  await rm(lockDir, { recursive: true, force: true })
  return true
}

export const withDirectoryInstallLock = async <T>(params: {
  lockDir: string
  retryMs?: number
  timeoutMs?: number
}, callback: () => Promise<T>) => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
  const retryMs = params.retryMs ?? DEFAULT_LOCK_RETRY_MS
  const start = Date.now()

  await mkdir(dirname(params.lockDir), { recursive: true })

  while (true) {
    try {
      await mkdir(params.lockDir)
      await writeLockMetadata(params.lockDir)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await clearStaleLock(params.lockDir, timeoutMs)) {
        continue
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for install lock ${params.lockDir}`)
      }
      await delay(retryMs)
    }
  }

  try {
    return await callback()
  } finally {
    await rm(params.lockDir, { recursive: true, force: true })
  }
}
