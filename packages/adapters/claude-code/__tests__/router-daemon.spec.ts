import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  generateDefaultCCRConfigJSON,
  resolveDefaultClaudeCodeRouterPort
} from '../src/ccr/config'
import { ensureClaudeCodeRouterReady } from '../src/ccr/daemon'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'claude-code-router-'))
  tempDirs.push(dir)
  return dir
}

const createCtx = (cwd: string, overrides?: Record<string, unknown>) =>
  ({
    cwd,
    env: {
      TEST_ENV: 'router'
    },
    configs: [undefined, {
      defaultModelService: 'gateway',
      defaultModel: 'gpt-5.4',
      modelServices: {
        gateway: {
          apiBaseUrl: 'https://example.test/chat/completions',
          apiKey: 'provider-key',
          models: ['gpt-5.4'],
          timeoutMs: 120000
        }
      },
      adapters: {
        'claude-code': {
          ccrOptions: {
            PORT: '4123',
            APIKEY: 'router-key'
          }
        }
      },
      ...(overrides ?? {})
    }]
  }) as any

const getRouterPaths = (cwd: string) => ({
  mockHome: join(cwd, '.ai', '.mock'),
  routerHome: join(cwd, '.ai', '.mock', '.claude-code-router'),
  configPath: join(cwd, '.ai', '.mock', '.claude-code-router', 'config.json'),
  pidPath: join(cwd, '.ai', '.mock', '.claude-code-router', '.claude-code-router.pid')
})

describe('ensureClaudeCodeRouterReady', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('starts a detached router daemon when no pid file exists', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace)
    const spawnDetached = vi.fn(async () => undefined)
    const waitForReady = vi.fn(async () => undefined)

    const connection = await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive: vi.fn(() => false),
      spawnDetached,
      stopProcess: vi.fn(async () => undefined),
      waitForReady
    })

    const { configPath, mockHome } = getRouterPaths(workspace)
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      PORT?: string
      APIKEY?: string
      API_TIMEOUT_MS?: number
    }

    expect(connection).toEqual({
      host: '127.0.0.1',
      port: 4123,
      apiKey: 'router-key',
      apiTimeoutMs: 120000
    })
    expect(config.PORT).toBe('4123')
    expect(config.APIKEY).toBe('router-key')
    expect(config.API_TIMEOUT_MS).toBe(120000)
    expect(spawnDetached).toHaveBeenCalledWith({
      cliPath: '/bin/sh',
      cwd: workspace,
      env: expect.objectContaining({
        TEST_ENV: 'router',
        HOME: mockHome,
        NODE_OPTIONS: '--conditions=__vibe-forge__ --require=/mock/register/preload.js'
      })
    })
    expect(waitForReady).toHaveBeenCalledWith(4123, 15000)
  })

  it('uses the workspace-derived port when CCR config does not specify one', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace, {
      adapters: {
        'claude-code': {}
      }
    })
    const spawnDetached = vi.fn(async () => undefined)
    const waitForReady = vi.fn(async () => undefined)

    const connection = await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive: vi.fn(() => false),
      spawnDetached,
      stopProcess: vi.fn(async () => undefined),
      waitForReady
    })

    const { configPath } = getRouterPaths(workspace)
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      PORT?: string
    }
    const expectedPort = resolveDefaultClaudeCodeRouterPort(workspace)

    expect(connection.port).toBe(expectedPort)
    expect(config.PORT).toBe(String(expectedPort))
    expect(waitForReady).toHaveBeenCalledWith(expectedPort, 15000)
    expect(spawnDetached).toHaveBeenCalledTimes(1)
  })

  it('preserves existing NODE_OPTIONS when preloading the TypeScript transformer runtime', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace)
    const spawnDetached = vi.fn(async () => undefined)
    vi.stubEnv('NODE_OPTIONS', '--trace-warnings')

    await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive: vi.fn(() => false),
      spawnDetached,
      stopProcess: vi.fn(async () => undefined),
      waitForReady: vi.fn(async () => undefined)
    })

    expect(spawnDetached).toHaveBeenCalledTimes(1)
    const spawnArgs = spawnDetached.mock.calls[0] as unknown as [{ env: NodeJS.ProcessEnv }]
    const spawnEnv = spawnArgs[0]?.env
    expect(spawnEnv.NODE_OPTIONS).toContain('--conditions=__vibe-forge__')
    expect(spawnEnv.NODE_OPTIONS).toContain('--require=/mock/register/preload.js')
    expect(spawnEnv.NODE_OPTIONS).toContain('--trace-warnings')
  })

  it('restarts the daemon when the pid file is stale', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace)
    const { pidPath, routerHome } = getRouterPaths(workspace)
    const spawnDetached = vi.fn(async () => undefined)
    const isProcessAlive = vi.fn(() => false)

    await mkdir(routerHome, { recursive: true })
    await writeFile(pidPath, '4321', 'utf8')

    await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive,
      spawnDetached,
      stopProcess: vi.fn(async () => undefined),
      waitForReady: vi.fn(async () => undefined)
    })

    await expect(readFile(pidPath, 'utf8')).rejects.toThrow()
    expect(isProcessAlive).toHaveBeenCalledWith(4321)
    expect(spawnDetached).toHaveBeenCalledTimes(1)
  })

  it('reuses a live daemon when config is unchanged', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace)
    const { configPath, pidPath, routerHome } = getRouterPaths(workspace)
    const configText = generateDefaultCCRConfigJSON({
      cwd: workspace,
      userConfig: ctx.configs[1],
      adapterOptions: ctx.configs[1].adapters['claude-code']
    })

    await mkdir(routerHome, { recursive: true })
    await writeFile(configPath, configText, 'utf8')
    await writeFile(pidPath, '2468', 'utf8')

    const spawnDetached = vi.fn(async () => undefined)
    const stopProcess = vi.fn(async () => undefined)
    const waitForReady = vi.fn(async () => undefined)

    const connection = await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive: vi.fn(() => true),
      spawnDetached,
      stopProcess,
      waitForReady
    })

    expect(connection.port).toBe(4123)
    expect(stopProcess).not.toHaveBeenCalled()
    expect(spawnDetached).not.toHaveBeenCalled()
    expect(waitForReady).toHaveBeenCalledWith(4123, 15000)
    await expect(readFile(pidPath, 'utf8')).resolves.toBe('2468')
  })

  it('restarts a live daemon when config changes', async () => {
    const workspace = await createWorkspace()
    const ctx = createCtx(workspace)
    const { configPath, pidPath, routerHome } = getRouterPaths(workspace)
    const oldConfigText = generateDefaultCCRConfigJSON({
      cwd: workspace,
      userConfig: {
        ...ctx.configs[1],
        adapters: {
          'claude-code': {
            ccrOptions: {
              PORT: '4001',
              APIKEY: 'old-router-key'
            }
          }
        }
      },
      adapterOptions: {
        ccrOptions: {
          PORT: '4001',
          APIKEY: 'old-router-key'
        }
      }
    })

    await mkdir(routerHome, { recursive: true })
    await writeFile(configPath, oldConfigText, 'utf8')
    await writeFile(pidPath, '1357', 'utf8')

    const spawnDetached = vi.fn(async () => undefined)
    const stopProcess = vi.fn(async () => undefined)
    const waitForReady = vi.fn(async () => undefined)

    const connection = await ensureClaudeCodeRouterReady(ctx, {
      resolveCliPath: () => '/bin/sh',
      resolveRuntimePreloadPath: () => '/mock/register/preload.js',
      isProcessAlive: vi.fn(() => true),
      spawnDetached,
      stopProcess,
      waitForReady
    })

    expect(connection).toEqual({
      host: '127.0.0.1',
      port: 4123,
      apiKey: 'router-key',
      apiTimeoutMs: 120000
    })
    expect(stopProcess).toHaveBeenCalledWith(1357)
    expect(spawnDetached).toHaveBeenCalledTimes(1)
    expect(stopProcess.mock.invocationCallOrder[0]).toBeLessThan(
      spawnDetached.mock.invocationCallOrder[0]
    )
    expect(waitForReady).toHaveBeenCalledWith(4123, 15000)
    await expect(readFile(pidPath, 'utf8')).rejects.toThrow()
    expect(await readFile(configPath, 'utf8')).not.toBe(oldConfigText)
  })
})
