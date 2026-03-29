import type { LogLevel } from '@vibe-forge/types'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const satisfies readonly LogLevel[]

export type { LogLevel } from '@vibe-forge/types'

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
