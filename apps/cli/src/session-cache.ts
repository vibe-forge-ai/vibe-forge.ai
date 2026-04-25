import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { RunTaskOptions } from '@vibe-forge/app-runtime'
import type { AdapterQueryOptions, TaskDetail } from '@vibe-forge/types'
import { resolveProjectAiPath } from '@vibe-forge/utils'
import { getCache, getCachePath, setCache } from '@vibe-forge/utils/cache'

export type CliOutputFormat = 'text' | 'json' | 'stream-json'

export interface CliSessionResumeRecord {
  version: 1
  ctxId: string
  sessionId: string
  cwd: string
  description?: string
  createdAt: number
  updatedAt: number
  resolvedAdapter?: string
  taskOptions: RunTaskOptions
  adapterOptions: Omit<AdapterQueryOptions, 'description' | 'onEvent' | 'type'>
  outputFormat: CliOutputFormat
}

export interface CliSessionRecord {
  resume?: CliSessionResumeRecord
  detail?: TaskDetail
}

export interface CliSessionControlRecord {
  signal: 'SIGTERM' | 'SIGKILL'
  requestedAt: number
  expiresAt: number
}

declare module '@vibe-forge/types' {
  interface Cache {
    'cli-session': CliSessionResumeRecord
    'cli-session-control': CliSessionControlRecord
    detail: TaskDetail
  }
}

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

const normalizeResumeCommandPrefix = (prefix: string | undefined) => {
  const normalizedPrefix = prefix?.trim()
  return normalizedPrefix == null || normalizedPrefix === '' ? 'vf' : normalizedPrefix
}

export const formatResumeCommand = (sessionId: string, prefix = process.env.__VF_CLI_RESUME_COMMAND_PREFIX__) =>
  `${normalizeResumeCommandPrefix(prefix)} --resume ${sessionId}`
export const formatStopCommand = (sessionId: string) => `vf stop ${sessionId}`
export const formatKillCommand = (sessionId: string) => `vf kill ${sessionId}`
export const formatListCommand = (params?: {
  running?: boolean
  view?: string
}) => {
  const args = ['vf', 'list']
  if (params?.running) args.push('--running')
  if (params?.view != null && params.view !== '') args.push('--view', params.view)
  return args.join(' ')
}

export const resolveCliSessionId = (record: CliSessionRecord) =>
  record.resume?.sessionId ?? record.detail?.sessionId ?? ''

export const resolveCliSessionCtxId = (record: CliSessionRecord) => record.resume?.ctxId ?? record.detail?.ctxId ?? ''

export const resolveCliSessionAdapter = (record: CliSessionRecord) =>
  record.resume?.resolvedAdapter ??
    record.detail?.adapter ??
    record.resume?.taskOptions.adapter ??
    ''

export const resolveCliSessionModel = (record: CliSessionRecord) =>
  record.detail?.model ?? record.resume?.adapterOptions.model ?? ''

export const resolveCliSessionDescription = (record: CliSessionRecord) =>
  record.detail?.description ?? record.resume?.description ?? ''

export const resolveCliSessionUpdatedAt = (record: CliSessionRecord) => getRecordUpdatedAt(record)

export const listCliSessions = async (cwd: string): Promise<CliSessionRecord[]> => {
  const cacheRoot = resolveProjectAiPath(cwd, process.env, 'caches')
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
      .map(resolveCliSessionId)
      .filter((value): value is string => value != null)
      .slice(0, 5)
      .join(', ')
    throw new Error(`Session id "${id}" is ambiguous: ${candidates}`)
  }

  throw new Error(
    `Session "${id}" not found. Use "${formatListCommand({ view: 'full' })}" to inspect available sessions.`
  )
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

export const readCliSessionControl = (
  cwd: string,
  ctxId: string,
  sessionId: string
) => getCache(cwd, ctxId, sessionId, 'cli-session-control')

export const writeCliSessionControl = (
  cwd: string,
  ctxId: string,
  sessionId: string,
  control: CliSessionControlRecord
) => setCache(cwd, ctxId, sessionId, 'cli-session-control', control)

export const clearCliSessionControl = async (
  cwd: string,
  ctxId: string,
  sessionId: string
) => {
  await fs.rm(getCachePath(cwd, ctxId, sessionId, 'cli-session-control'), { force: true })
}

export const isCliSessionStopActive = (
  control: CliSessionControlRecord | undefined,
  endedAt: number
) => control != null && endedAt <= control.expiresAt
