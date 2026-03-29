import { describe, expect, it } from 'vitest'

import { resolveServerLogLevel } from '#~/log-level.js'

describe('log level helpers', () => {
  it('forces debug level when __VF_PROJECT_AI_SERVER_DEBUG__ is enabled', () => {
    expect(resolveServerLogLevel({
      __VF_PROJECT_AI_SERVER_LOG_LEVEL__: 'error',
      __VF_PROJECT_AI_SERVER_DEBUG__: 'true'
    })).toBe('debug')
  })

  it('defaults to info when no debug config is provided', () => {
    expect(resolveServerLogLevel({})).toBe('info')
  })
})
