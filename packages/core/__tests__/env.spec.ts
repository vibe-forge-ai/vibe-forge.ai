import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('forces debug level when __VF_PROJECT_AI_SERVER_DEBUG__ is enabled', async () => {
    const { resolveServerLogLevel } = await import('../src/env')

    expect(resolveServerLogLevel({
      __VF_PROJECT_AI_SERVER_LOG_LEVEL__: 'error',
      __VF_PROJECT_AI_SERVER_DEBUG__: 'true'
    })).toBe('debug')
  })

  it('defaults to info when no debug config is provided', async () => {
    const { resolveServerLogLevel } = await import('../src/env')

    expect(resolveServerLogLevel({})).toBe('info')
  })

  it('parses __VF_PROJECT_AI_SERVER_DEBUG__ from process env', async () => {
    vi.stubEnv('__VF_PROJECT_AI_SERVER_DEBUG__', 'true')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_LOG_LEVEL__', 'warn')
    vi.stubEnv('__VF_PROJECT_AI_PUBLIC_BASE_URL__', 'https://lan.example')
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'action-secret')

    const { loadEnv } = await import('../src/env')

    expect(loadEnv()).toEqual(expect.objectContaining({
      __VF_PROJECT_AI_SERVER_DEBUG__: true,
      __VF_PROJECT_AI_SERVER_LOG_LEVEL__: 'warn',
      __VF_PROJECT_AI_PUBLIC_BASE_URL__: 'https://lan.example',
      __VF_PROJECT_AI_SERVER_ACTION_SECRET__: 'action-secret'
    }))
  })
})
