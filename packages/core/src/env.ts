import { env as processEnv } from 'node:process'

import type { LogLevel } from '@vibe-forge/utils/log-level'
import { normalizeLogLevel } from '@vibe-forge/utils/log-level'

export type { LogLevel } from '@vibe-forge/utils/log-level'
export { normalizeLogLevel, resolveServerLogLevel } from '@vibe-forge/utils/log-level'

export interface ServerEnv {
  __VF_PROJECT_AI_SERVER_HOST__: string
  __VF_PROJECT_AI_SERVER_PORT__: number
  __VF_PROJECT_AI_SERVER_WS_PATH__: string
  __VF_PROJECT_AI_PUBLIC_BASE_URL__?: string
  __VF_PROJECT_AI_SERVER_ACTION_SECRET__?: string
  __VF_PROJECT_AI_SERVER_DATA_DIR__: string
  __VF_PROJECT_AI_SERVER_LOG_DIR__: string
  __VF_PROJECT_AI_SERVER_LOG_LEVEL__: LogLevel
  __VF_PROJECT_AI_SERVER_DEBUG__: boolean
  __VF_PROJECT_AI_SERVER_ALLOW_CORS__: boolean
  __VF_PROJECT_AI_CLIENT_MODE__?: 'dev' | 'none' | 'static' | 'standalone' | 'independent' | 'desktop'
  __VF_PROJECT_AI_CLIENT_BASE__?: string
  __VF_PROJECT_AI_CLIENT_DIST_PATH__?: string
}

export function loadEnv(): ServerEnv {
  const {
    __VF_PROJECT_AI_SERVER_HOST__ = 'localhost',
    __VF_PROJECT_AI_SERVER_PORT__ = '8787',
    __VF_PROJECT_AI_SERVER_WS_PATH__ = '/ws',
    __VF_PROJECT_AI_PUBLIC_BASE_URL__,
    __VF_PROJECT_AI_SERVER_ACTION_SECRET__,
    __VF_PROJECT_AI_SERVER_DATA_DIR__ = '.data',
    __VF_PROJECT_AI_SERVER_LOG_DIR__ = '.logs',
    __VF_PROJECT_AI_SERVER_LOG_LEVEL__ = 'info',
    __VF_PROJECT_AI_SERVER_DEBUG__,
    __VF_PROJECT_AI_SERVER_ALLOW_CORS__,
    __VF_PROJECT_AI_CLIENT_MODE__ = 'static',
    __VF_PROJECT_AI_CLIENT_BASE__,
    __VF_PROJECT_AI_CLIENT_DIST_PATH__
  } = processEnv || {}
  return {
    __VF_PROJECT_AI_SERVER_HOST__,
    __VF_PROJECT_AI_SERVER_PORT__: Number(__VF_PROJECT_AI_SERVER_PORT__),
    __VF_PROJECT_AI_SERVER_WS_PATH__,
    __VF_PROJECT_AI_PUBLIC_BASE_URL__,
    __VF_PROJECT_AI_SERVER_ACTION_SECRET__,
    __VF_PROJECT_AI_SERVER_DATA_DIR__,
    __VF_PROJECT_AI_SERVER_LOG_DIR__,
    __VF_PROJECT_AI_SERVER_LOG_LEVEL__: normalizeLogLevel(__VF_PROJECT_AI_SERVER_LOG_LEVEL__) ?? 'info',
    __VF_PROJECT_AI_SERVER_DEBUG__: __VF_PROJECT_AI_SERVER_DEBUG__ === 'true',
    __VF_PROJECT_AI_SERVER_ALLOW_CORS__: __VF_PROJECT_AI_SERVER_ALLOW_CORS__ != null
      ? __VF_PROJECT_AI_SERVER_ALLOW_CORS__ === 'true'
      : true,
    __VF_PROJECT_AI_CLIENT_MODE__: __VF_PROJECT_AI_CLIENT_MODE__ as ServerEnv['__VF_PROJECT_AI_CLIENT_MODE__'],
    __VF_PROJECT_AI_CLIENT_BASE__,
    __VF_PROJECT_AI_CLIENT_DIST_PATH__
  }
}
