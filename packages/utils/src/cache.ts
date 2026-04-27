import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import type { Cache } from '@vibe-forge/types'

import { resolveProjectAiPath } from './ai-path'

const ADAPTER_RESUME_CACHE_KEYS = new Set<string>([
  'adapter.codex.threads',
  'adapter.claude-code.resume-state',
  'adapter.copilot.session',
  'adapter.gemini.session',
  'adapter.opencode.session'
])

export const getCachePath = (
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  key: keyof Cache
) => {
  const taskDir = resolveProjectAiPath(cwd, process.env, 'caches', taskId)
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

const readDirSafe = async (targetPath: string) => {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export const getCacheWithLegacyFallback = async <K extends keyof Cache>(
  cwd: string,
  taskId: string,
  sessionId: string | undefined,
  key: K
): Promise<Cache[K] | undefined> => {
  const current = await getCache(cwd, taskId, sessionId, key)
  if (current !== undefined || sessionId == null || !ADAPTER_RESUME_CACHE_KEYS.has(String(key))) {
    return current
  }

  const cacheRoot = resolveProjectAiPath(cwd, process.env, 'caches')
  const ctxEntries = await readDirSafe(cacheRoot)
  const candidates: Array<{ ctxId: string; mtimeMs: number; value: Cache[K] }> = []

  for (const ctxEntry of ctxEntries) {
    if (!ctxEntry.isDirectory() || ctxEntry.name === taskId) continue

    const legacyPath = getCachePath(cwd, ctxEntry.name, sessionId, key)
    let mtimeMs = 0
    try {
      mtimeMs = (await fs.stat(legacyPath)).mtimeMs
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      throw error
    }

    const value = await getCache(cwd, ctxEntry.name, sessionId, key)
    if (value !== undefined) {
      candidates.push({ ctxId: ctxEntry.name, mtimeMs, value })
    }
  }

  const legacy = candidates.sort((left, right) =>
    right.mtimeMs - left.mtimeMs || left.ctxId.localeCompare(right.ctxId)
  )[0]?.value
  if (legacy === undefined) {
    return undefined
  }

  await setCache(cwd, taskId, sessionId, key, legacy)
  return legacy
}
