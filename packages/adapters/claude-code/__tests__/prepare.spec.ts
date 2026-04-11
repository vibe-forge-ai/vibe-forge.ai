import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import '../src/adapter-config'
import { ensureClaudeCodeRouterReady } from '../src/ccr/daemon'
import { prepareClaudeExecution } from '../src/claude/prepare'

vi.mock('../src/ccr/paths', () => ({
  resolveClaudeCliPath: vi.fn(() => '/mock/claude')
}))

vi.mock('../src/ccr/daemon', () => ({
  ensureClaudeCodeRouterReady: vi.fn()
}))

describe('prepareClaudeExecution', () => {
  let settingsSnapshot: Record<string, any> | undefined

  const buildNativeBootstrapPrepared = async (model: string, apiKey = 'anthropic-key') => {
    const cwd = await mkdtemp(join(tmpdir(), 'claude-native-model-'))

    vi.mocked(ensureClaudeCodeRouterReady).mockResolvedValue({
      host: '127.0.0.1',
      port: 3100,
      apiKey: 'router-key',
      apiTimeoutMs: 30000
    } as any)

    return prepareClaudeExecution({
      ctxId: 'ctx-native-model',
      cwd,
      env: apiKey !== ''
        ? { ANTHROPIC_API_KEY: apiKey }
        : {},
      cache: {
        set: vi.fn(async (key: string, value: unknown) => {
          if (key === 'adapter.claude-code.settings') {
            settingsSnapshot = value as Record<string, any>
          }

          return {
            cachePath: `/tmp/${key}.json`
          }
        }) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{
        adapters: {
          'claude-code': {
            nativeModelSwitch: true,
            nativeModelSwitchBootstrap: true
          }
        },
        modelServices: {
          'hook-smoke-mock-ccr': {
            apiBaseUrl: 'http://127.0.0.1:40111/chat/completions',
            apiKey: 'test-key',
            models: ['claude-hooks'],
            description: 'Mock Claude router'
          }
        }
      }, {}]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: '4a7eb9d9-0707-40bb-b69b-f7c933df5229',
      model,
      onEvent: vi.fn()
    })
  }

  beforeEach(() => {
    settingsSnapshot = undefined
    vi.mocked(ensureClaudeCodeRouterReady).mockReset()
  })

  it('disables the native AskUserQuestion tool for server runtime sessions', async () => {
    const cacheSet = vi.fn(async (key: string, value: unknown) => {
      if (key === 'adapter.claude-code.settings') {
        settingsSnapshot = value as Record<string, any>
      }

      return {
        cachePath: `/tmp/${key}.json`
      }
    })

    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-1',
      cwd: '/repo',
      env: {},
      cache: {
        set: cacheSet as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'sess-1',
      tools: {
        include: ['AskUserQuestion', 'Read']
      },
      onEvent: vi.fn()
    })

    expect(prepared.cliPath).toBe('/mock/claude')
    expect(settingsSnapshot?.permissions.allow).toContain('Read')
    expect(settingsSnapshot?.permissions.allow).not.toContain('AskUserQuestion')
    expect(settingsSnapshot?.permissions.deny).toContain('AskUserQuestion')
  })

  it('passes bypassPermissions through to the Claude CLI in headless mode', async () => {
    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-1',
      cwd: '/repo',
      env: {},
      cache: {
        set: vi.fn(async (key: string) => ({
          cachePath: `/tmp/${key}.json`
        })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'sess-2',
      permissionMode: 'bypassPermissions',
      onEvent: vi.fn()
    })

    expect(prepared.args).toContain('--dangerously-skip-permissions')
    expect(prepared.args).not.toContain('--permission-mode')
  })

  it('stages managed Claude plugins into the session cache and passes --plugin-dir', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'claude-prepare-'))
    await mkdir(join(cwd, '.ai/plugins/demo/native/.claude-plugin'), { recursive: true })
    await mkdir(join(cwd, '.ai/plugins/demo/vibe-forge'), { recursive: true })
    await writeFile(
      join(cwd, '.ai/plugins/demo/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'demo',
          scope: 'demo',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './demo'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )
    await writeFile(join(cwd, '.ai/plugins/demo/native/.claude-plugin/plugin.json'), JSON.stringify({ name: 'demo' }))

    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-plugins',
      cwd,
      env: {},
      cache: {
        set: vi.fn(async (key: string) => ({
          cachePath: `/tmp/${key}.json`
        })) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      configs: [{}, {}]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-plugins',
      onEvent: vi.fn()
    })

    const pluginDirIndex = prepared.args.findIndex(arg => arg === '--plugin-dir')
    expect(pluginDirIndex).toBeGreaterThan(-1)
    const stagedPluginDir = prepared.args[pluginDirIndex + 1]
    expect(stagedPluginDir).toContain('.ai/caches/ctx-plugins/sess-plugins/.claude-plugins/')
  })

  it('preserves native builtin transport when native bootstrap starts on default', async () => {
    const prepared = await buildNativeBootstrapPrepared('default')

    expect(ensureClaudeCodeRouterReady).not.toHaveBeenCalled()
    expect(prepared.env.ANTHROPIC_BASE_URL).toBeUndefined()
    expect(prepared.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    // Custom model option is advertised in /model menu even for builtin starts
    // (incremental extension), but CCR is NOT injected.
    expect(prepared.env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe('hook-smoke-mock-ccr,claude-hooks')
    // nativeCatalog is returned for model tracking even when starting on a builtin.
    expect(prepared.nativeCatalog).toBeDefined()
    expect(prepared.nativeCatalog?.routes.some(route => route.kind === 'service')).toBe(true)
  })

  it('preserves native builtin transport when native bootstrap starts on sonnet', async () => {
    const prepared = await buildNativeBootstrapPrepared('sonnet')

    expect(ensureClaudeCodeRouterReady).not.toHaveBeenCalled()
    expect(prepared.env.ANTHROPIC_BASE_URL).toBeUndefined()
    expect(prepared.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    // Custom model option is advertised in /model menu even for builtin starts.
    expect(prepared.env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe('hook-smoke-mock-ccr,claude-hooks')
    expect(prepared.nativeCatalog).toBeDefined()
  })

  it('supports custom-started native bootstrap without an Anthropic API key', async () => {
    const prepared = await buildNativeBootstrapPrepared('hook-smoke-mock-ccr,claude-hooks', '')

    expect(ensureClaudeCodeRouterReady).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.not.objectContaining({
          ANTHROPIC_API_KEY: expect.anything()
        })
      }),
      []
    )
    expect(prepared.nativeCatalog?.routes.some(route => route.kind === 'service')).toBe(true)
    expect(settingsSnapshot?.env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:3100')
    expect(settingsSnapshot?.env.ANTHROPIC_AUTH_TOKEN).toBe('router-key')
    expect(prepared.env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe('hook-smoke-mock-ccr,claude-hooks')
  })

  it('starts CCR for comma-model even when native bootstrap is disabled', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'claude-no-bootstrap-'))

    vi.mocked(ensureClaudeCodeRouterReady).mockResolvedValue({
      host: '127.0.0.1',
      port: 3200,
      apiKey: 'router-key-nb',
      apiTimeoutMs: 30000
    } as any)

    const prepared = await prepareClaudeExecution({
      ctxId: 'ctx-no-bootstrap',
      cwd,
      env: { ANTHROPIC_API_KEY: 'ak-test' },
      cache: {
        set: vi.fn(async (key: string, value: unknown) => {
          if (key === 'adapter.claude-code.settings') {
            settingsSnapshot = value as Record<string, any>
          }
          return { cachePath: `/tmp/${key}.json` }
        }) as any,
        get: vi.fn(async () => undefined) as any
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any,
      // nativeModelSwitch / nativeModelSwitchBootstrap NOT set
      configs: [{
        modelServices: {
          'my-svc': {
            apiBaseUrl: 'http://localhost:9999',
            apiKey: 'svc-key',
            models: ['my-model']
          }
        }
      }, {}]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'sess-no-bootstrap',
      model: 'my-svc,my-model',
      onEvent: vi.fn()
    })

    // CCR must start even without native bootstrap
    expect(ensureClaudeCodeRouterReady).toHaveBeenCalled()
    expect(settingsSnapshot?.env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:3200')
    expect(settingsSnapshot?.env.ANTHROPIC_AUTH_TOKEN).toBe('router-key-nb')
    // No native catalog when bootstrap is off
    expect(prepared.nativeCatalog).toBeUndefined()
    // No custom model option without native bootstrap catalog
    expect(prepared.env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBeUndefined()
  })
})
