import { env as processEnv } from 'node:process'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface ServerEnv {
  __VF_PROJECT_AI_SERVER_HOST__: string
  __VF_PROJECT_AI_SERVER_PORT__: number
  __VF_PROJECT_AI_SERVER_WS_PATH__: string
  __VF_PROJECT_AI_SERVER_DATA_DIR__: string
  __VF_PROJECT_AI_SERVER_LOG_DIR__: string
  __VF_PROJECT_AI_SERVER_LOG_LEVEL__: LogLevel
  __VF_PROJECT_AI_SERVER_DEBUG__: boolean
  __VF_PROJECT_AI_SERVER_ALLOW_CORS__: boolean
  __VF_PROJECT_AI_CLIENT_MODE__?: 'dev' | 'static'
  __VF_PROJECT_AI_CLIENT_BASE__?: string
  __VF_PROJECT_AI_CLIENT_DIST_PATH__?: string
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const satisfies readonly LogLevel[]

export function normalizeLogLevel(value: unknown): LogLevel | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return LOG_LEVELS.includes(normalized as LogLevel)
    ? normalized as LogLevel
    : undefined
}

export function resolveServerLogLevel(
  env: {
    __VF_PROJECT_AI_SERVER_LOG_LEVEL__?: unknown
    __VF_PROJECT_AI_SERVER_DEBUG__?: unknown
  },
  fallback: LogLevel = 'info'
): LogLevel {
  if (env.__VF_PROJECT_AI_SERVER_DEBUG__ === true || env.__VF_PROJECT_AI_SERVER_DEBUG__ === 'true') {
    return 'debug'
  }

  return normalizeLogLevel(env.__VF_PROJECT_AI_SERVER_LOG_LEVEL__) ?? fallback
}

export function loadEnv(): ServerEnv {
  const {
    __VF_PROJECT_AI_SERVER_HOST__ = 'localhost',
    __VF_PROJECT_AI_SERVER_PORT__ = '8787',
    __VF_PROJECT_AI_SERVER_WS_PATH__ = '/ws',
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
