import fs from 'node:fs/promises'

import type { AskUserQuestionParams, SessionPermissionMode } from '@vibe-forge/types'
import { getCache, getCachePath, setCache } from '@vibe-forge/utils/cache'

export interface CliSessionPermissionRecoveryRecord {
  version: 1
  sessionId: string
  adapter?: string
  permissionMode?: SessionPermissionMode
  subjectKeys: string[]
  payload: AskUserQuestionParams
}

declare module '@vibe-forge/types' {
  interface Cache {
    'cli-session-permission-recovery': CliSessionPermissionRecoveryRecord
  }
}

export const readCliSessionPermissionRecovery = (
  cwd: string,
  ctxId: string,
  sessionId: string
) => getCache(cwd, ctxId, sessionId, 'cli-session-permission-recovery')

export const writeCliSessionPermissionRecovery = (
  cwd: string,
  ctxId: string,
  sessionId: string,
  record: CliSessionPermissionRecoveryRecord
) => setCache(cwd, ctxId, sessionId, 'cli-session-permission-recovery', record)

export const clearCliSessionPermissionRecovery = async (
  cwd: string,
  ctxId: string,
  sessionId: string
) => {
  await fs.rm(getCachePath(cwd, ctxId, sessionId, 'cli-session-permission-recovery'), { force: true })
}
