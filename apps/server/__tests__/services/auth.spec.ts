import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServerEnv } from '@vibe-forge/core'

const loadConfigState = vi.fn()

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState
}))

vi.mock('#~/utils/logger.js', () => ({
  logger: {
    info: vi.fn()
  }
}))

const createEnv = (dataDir: string): ServerEnv => ({
  __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
  __VF_PROJECT_AI_SERVER_PORT__: 0,
  __VF_PROJECT_AI_SERVER_WS_PATH__: '/ws',
  __VF_PROJECT_AI_SERVER_DATA_DIR__: dataDir,
  __VF_PROJECT_AI_SERVER_LOG_DIR__: '.logs',
  __VF_PROJECT_AI_SERVER_LOG_LEVEL__: 'info',
  __VF_PROJECT_AI_SERVER_DEBUG__: false,
  __VF_PROJECT_AI_SERVER_ALLOW_CORS__: true
})

const createEnvWithHost = (dataDir: string, host: string): ServerEnv => ({
  ...createEnv(dataDir),
  __VF_PROJECT_AI_SERVER_HOST__: host
})

describe('web auth service', () => {
  let dataDir: string

  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
    dataDir = await mkdtemp(join(tmpdir(), 'vf-auth-'))
    loadConfigState.mockResolvedValue({
      mergedConfig: {},
      projectConfig: undefined,
      userConfig: undefined,
      workspaceFolder: process.cwd()
    })
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await rm(dataDir, { recursive: true, force: true })
  })

  it('resolves configured account list', async () => {
    loadConfigState.mockResolvedValueOnce({
      mergedConfig: {
        webAuth: {
          enabled: true,
          accounts: [
            { username: 'alice', password: 'one' },
            { username: 'bob', password: 'two' }
          ]
        }
      },
      projectConfig: undefined,
      userConfig: undefined,
      workspaceFolder: process.cwd()
    })

    const { findMatchingAccount, resolveWebAuthConfig } = await import('#~/services/auth/index.js')
    const config = await resolveWebAuthConfig(createEnv(dataDir))

    expect(config.enabled).toBe(true)
    expect(config.accounts.map(account => account.username)).toEqual(['alice', 'bob'])
    expect(findMatchingAccount(config, 'bob', 'two')?.username).toBe('bob')
    expect(findMatchingAccount(config, 'bob', 'wrong')).toBeUndefined()
  })

  it('disables auth by default on local server hosts', async () => {
    const { resolveWebAuthConfig } = await import('#~/services/auth/index.js')

    await expect(resolveWebAuthConfig(createEnvWithHost(dataDir, 'localhost')))
      .resolves.toMatchObject({ enabled: false })
    await expect(resolveWebAuthConfig(createEnvWithHost(dataDir, '127.0.0.1')))
      .resolves.toMatchObject({ enabled: false })
    await expect(resolveWebAuthConfig(createEnvWithHost(dataDir, '::1')))
      .resolves.toMatchObject({ enabled: false })
  })

  it('enables auth by default on non-local server hosts', async () => {
    const { resolveWebAuthConfig } = await import('#~/services/auth/index.js')

    await expect(resolveWebAuthConfig(createEnvWithHost(dataDir, '0.0.0.0')))
      .resolves.toMatchObject({ enabled: true })
    await expect(resolveWebAuthConfig(createEnvWithHost(dataDir, '192.168.1.8')))
      .resolves.toMatchObject({ enabled: true })
  })

  it('lets explicit config override the host-based default', async () => {
    loadConfigState.mockResolvedValueOnce({
      mergedConfig: {
        webAuth: {
          enabled: false,
          password: 'one'
        }
      },
      projectConfig: undefined,
      userConfig: undefined,
      workspaceFolder: process.cwd()
    })

    const { resolveWebAuthConfig } = await import('#~/services/auth/index.js')
    const config = await resolveWebAuthConfig(createEnvWithHost(dataDir, '0.0.0.0'))

    expect(config.enabled).toBe(false)
  })

  it('uses a configurable remember-device ttl', async () => {
    loadConfigState.mockResolvedValueOnce({
      mergedConfig: {
        webAuth: {
          password: 'one',
          rememberDeviceTtlDays: 14
        }
      },
      projectConfig: undefined,
      userConfig: undefined,
      workspaceFolder: process.cwd()
    })

    const { resolveWebAuthConfig } = await import('#~/services/auth/index.js')
    const config = await resolveWebAuthConfig(createEnv(dataDir))

    expect(config.sessionTtlMs).toBe(7 * 24 * 60 * 60 * 1000)
    expect(config.rememberDeviceTtlMs).toBe(14 * 24 * 60 * 60 * 1000)
  })

  it('allows env password to provide a single runtime account', async () => {
    vi.stubEnv('__VF_PROJECT_AI_WEB_AUTH_USERNAME', 'root')
    vi.stubEnv('__VF_PROJECT_AI_WEB_AUTH_PASSWORD', 'from-env')

    const { findMatchingAccount, resolveWebAuthConfig } = await import('#~/services/auth/index.js')
    const config = await resolveWebAuthConfig(createEnv(dataDir))

    expect(config.passwordSource).toBe('env')
    expect(config.accounts.map(account => account.username)).toEqual(['root'])
    expect(findMatchingAccount(config, 'root', 'from-env')?.username).toBe('root')
  })

  it('creates and verifies signed session tokens', async () => {
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    const { createSessionToken, verifySessionToken } = await import('#~/services/auth/index.js')
    const env = createEnv(dataDir)
    const token = await createSessionToken(env, 'alice', 60_000)

    expect(await verifySessionToken(env, token)).toBe(true)
    expect(await verifySessionToken(env, `${token}x`)).toBe(false)
  })
})
