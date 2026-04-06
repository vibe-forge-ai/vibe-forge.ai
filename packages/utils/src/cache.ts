import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import type { Cache } from '@vibe-forge/types'

export const getCachePath = (
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  key: keyof Cache
) => {
  const taskDir = resolve(cwd, '.ai/caches', taskId)
  const cacheDir = sessionId ? resolve(taskDir, sessionId) : taskDir
  return resolve(cacheDir, `${key}.json`)
}

export const setCache = async <K extends keyof Cache>(
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  key: K,
  value: Cache[K]
) => {
  const cachePath = getCachePath(cwd, taskId, sessionId, key)
  const cacheDir = dirname(cachePath)
  try {
    await fs.access(cacheDir)
  } catch {
    await fs.mkdir(cacheDir, { recursive: true })
  }
  const tempPath = `${cachePath}.${randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), {
    flag: 'w'
  })
  await fs.rename(tempPath, cachePath)
  return { cachePath }
}

export const getCache = async <K extends keyof Cache>(
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  key: K
): Promise<Cache[K] | undefined> => {
  const cachePath = getCachePath(cwd, taskId, sessionId, key)
  try {
    await fs.access(cachePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
  const content = await fs.readFile(cachePath, 'utf-8')

  if (content.trim() === '') {
    return undefined
  }

  try {
    return JSON.parse(content) as Cache[K]
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}
