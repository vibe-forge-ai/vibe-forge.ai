import fs from 'node:fs/promises'
import path from 'node:path'

import type { RunTaskOptions } from '@vibe-forge/app-runtime'
import type { AdapterQueryOptions, TaskDetail } from '@vibe-forge/types'
import { getCache, setCache } from '@vibe-forge/utils/cache'

export type CliOutputFormat = 'text' | 'json' | 'stream-json'

export interface CliSessionResumeRecord {
  version: 1
  ctxId: string
  sessionId: string
  cwd: string
  description?: string
  createdAt: number
  updatedAt: number
  taskOptions: RunTaskOptions
  adapterOptions: Omit<AdapterQueryOptions, 'description' | 'onEvent' | 'type'>
  outputFormat: CliOutputFormat
}

export interface CliSessionRecord {
  resume?: CliSessionResumeRecord
  detail?: TaskDetail
}

declare module '@vibe-forge/types' {
  interface Cache {
    'cli-session': CliSessionResumeRecord
    detail: TaskDetail
  }
}

const CACHE_ROOT = '.ai/caches'

const readDirSafe = async (target: string) => {
  try {
    return await fs.readdir(target, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

const getRecordUpdatedAt = (record: CliSessionRecord) =>
  record.resume?.updatedAt ??
    record.detail?.endTime ??
    record.detail?.startTime ??
    0

const isSessionDirNameMatch = (value: string, target: string) => value === target || value.startsWith(target)

export const formatResumeCommand = (sessionId: string) => `vf --resume ${sessionId}`

export const listCliSessions = async (cwd: string): Promise<CliSessionRecord[]> => {
  const cacheRoot = path.resolve(cwd, CACHE_ROOT)
  const ctxEntries = await readDirSafe(cacheRoot)
  const sessions: CliSessionRecord[] = []

  for (const ctxEntry of ctxEntries) {
    if (!ctxEntry.isDirectory()) continue

    const ctxId = ctxEntry.name
    const sessionEntries = await readDirSafe(path.resolve(cacheRoot, ctxId))

    for (const sessionEntry of sessionEntries) {
      if (!sessionEntry.isDirectory()) continue

      const sessionId = sessionEntry.name
      const [resume, detail] = await Promise.all([
        getCache(cwd, ctxId, sessionId, 'cli-session'),
        getCache(cwd, ctxId, sessionId, 'detail')
      ])

      if (resume == null && detail == null) continue
      sessions.push({ resume, detail })
    }
  }

  return sessions.sort((left, right) => getRecordUpdatedAt(right) - getRecordUpdatedAt(left))
}

export const resolveCliSession = async (cwd: string, id: string): Promise<CliSessionRecord> => {
  const sessions = await listCliSessions(cwd)
  const normalizedId = id.trim()

  const exactSessionMatch = sessions.find((record) =>
    (record.resume?.sessionId ?? record.detail?.sessionId) === normalizedId
  )
  if (exactSessionMatch != null) return exactSessionMatch

  const exactCtxMatches = sessions.filter((record) => (record.resume?.ctxId ?? record.detail?.ctxId) === normalizedId)
  if (exactCtxMatches.length === 1) return exactCtxMatches[0]!
  if (exactCtxMatches.length > 1) {
    throw new Error(`Session id "${id}" matches multiple task contexts. Use a session id instead.`)
  }

  const prefixMatches = sessions.filter((record) => {
    const sessionId = record.resume?.sessionId ?? record.detail?.sessionId
    const ctxId = record.resume?.ctxId ?? record.detail?.ctxId
    return (
      (sessionId != null && isSessionDirNameMatch(sessionId, normalizedId)) ||
      (ctxId != null && isSessionDirNameMatch(ctxId, normalizedId))
    )
  })

  if (prefixMatches.length === 1) return prefixMatches[0]!
  if (prefixMatches.length > 1) {
    const candidates = prefixMatches
      .map((record) => record.resume?.sessionId ?? record.detail?.sessionId)
      .filter((value): value is string => value != null)
      .slice(0, 5)
      .join(', ')
    throw new Error(`Session id "${id}" is ambiguous: ${candidates}`)
  }

  throw new Error(`Session "${id}" not found. Use "vf list" to inspect available sessions.`)
}

export const writeCliSessionRecord = async (
  cwd: string,
  ctxId: string,
  sessionId: string,
  record: CliSessionRecord
) => {
  await Promise.all([
    record.resume == null
      ? Promise.resolve()
      : setCache(cwd, ctxId, sessionId, 'cli-session', record.resume),
    record.detail == null
      ? Promise.resolve()
      : setCache(cwd, ctxId, sessionId, 'detail', record.detail)
  ])
}
