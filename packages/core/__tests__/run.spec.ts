import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdapterCtx } from '#~/adapter/index.js'
import { run } from '#~/controllers/task/run.js'
import type { Logger } from '#~/utils/create-logger.js'
import type { WorkspaceAssetBundle } from '#~/utils/workspace-assets.js'

const {
  prepareMock,
  loadAdapterMock,
  callHookMock,
  createAdapterHookBridgeMock,
  initMock,
  queryMock
} = vi.hoisted(() => ({
  prepareMock: vi.fn(),
  loadAdapterMock: vi.fn(),
  callHookMock: vi.fn(),
  createAdapterHookBridgeMock: vi.fn(),
  initMock: vi.fn(),
  queryMock: vi.fn()
}))

vi.mock('#~/controllers/task/prepare.js', () => ({
  prepare: prepareMock
}))

vi.mock('#~/adapter/index.js', () => ({
  loadAdapter: loadAdapterMock
}))

vi.mock('#~/hooks/call.js', () => ({
  callHook: callHookMock
}))

vi.mock('#~/hooks/bridge.js', () => ({
  createAdapterHookBridge: createAdapterHookBridgeMock
}))

type TestCtx = AdapterCtx & {
  assets: WorkspaceAssetBundle
}

const createLogger = (): Logger => ({
  stream: new PassThrough(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
})

const createAssets = (): WorkspaceAssetBundle => ({
  cwd: '/tmp/project',
  assets: [],
  rules: [],
  specs: [],
  entities: [],
  skills: [],
  mcpServers: {},
  hookPlugins: [],
  enabledPlugins: {},
  extraKnownMarketplaces: {},
  defaultIncludeMcpServers: [],
  defaultExcludeMcpServers: []
})

const createAdapters = (adapters: Record<string, unknown>) => (
  adapters as NonNullable<NonNullable<AdapterCtx['configs'][0]>['adapters']>
)

const createCtx = (): TestCtx => ({
  ctxId: 'ctx-1',
  cwd: '/tmp/project',
  env: {},
  cache: {
    set: vi.fn().mockResolvedValue({ cachePath: '/tmp/project/.ai/cache/base.json' }),
    get: vi.fn()
  } as AdapterCtx['cache'],
  logger: createLogger(),
  configs: [
    {
      adapters: createAdapters({
        codex: {}
      })
    },
    undefined
  ] as AdapterCtx['configs'],
  assets: createAssets()
})

describe('task run adapter init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initMock.mockResolvedValue(undefined)
    queryMock.mockResolvedValue({
      kill: vi.fn(),
      emit: vi.fn()
    })
    loadAdapterMock.mockResolvedValue({
      init: initMock,
      query: queryMock
    })
    createAdapterHookBridgeMock.mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      prepareInitialPrompt: vi.fn(async (prompt?: string) => prompt),
      wrapSession: vi.fn((session: unknown) => session),
      handleOutput: vi.fn()
    })
    callHookMock.mockResolvedValue({ continue: true })
  })

  it('runs adapter init before query', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-cli',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(loadAdapterMock).toHaveBeenCalledWith('codex')
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(ctx)
    expect(queryMock).toHaveBeenCalledTimes(1)
    const initCallOrder = initMock.mock.invocationCallOrder[0]
    const queryCallOrder = queryMock.mock.invocationCallOrder[0]
    expect(initCallOrder).toBeDefined()
    expect(queryCallOrder).toBeDefined()
    if (initCallOrder == null || queryCallOrder == null) {
      throw new Error('expected init and query to be invoked')
    }
    expect(initCallOrder).toBeLessThan(queryCallOrder)
  })

  it('also runs adapter init for non-CLI runtimes', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-server',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith(ctx)
    expect(queryMock).toHaveBeenCalledTimes(1)
  })

  it('attaches the adapter asset plan to query options', async () => {
    const ctx = createCtx()
    ctx.assets.assets = [
      {
        id: 'nativePlugin:claude-code:logger',
        kind: 'nativePlugin',
        pluginId: 'logger',
        origin: 'config',
        scope: 'project',
        enabled: true,
        targets: ['claude-code'],
        payload: {
          name: 'logger',
          enabled: true
        }
      }
    ]
    ctx.assets.enabledPlugins = { logger: true }
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-assets',
      promptAssetIds: ['skill:.ai/skills/research/SKILL.md'],
      onEvent: vi.fn()
    })

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        adapter: 'codex',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            assetId: 'skill:.ai/skills/research/SKILL.md',
            status: 'prompt'
          }),
          expect.objectContaining({
            assetId: 'nativePlugin:claude-code:logger',
            status: 'skipped'
          })
        ])
      }
    })
  })

  it('disables overlapping bridge events when claude native hooks are active', async () => {
    const ctx = createCtx()
    ctx.env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ = '1'
    ctx.configs = [{
      adapters: createAdapters({
        'claude-code': {}
      })
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'claude-code',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-claude-native',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(createAdapterHookBridgeMock).toHaveBeenCalledWith(expect.objectContaining({
      adapter: 'claude-code',
      disabledEvents: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']
    }))
  })

  it('disables only native opencode hook events when the managed plugin bridge is active', async () => {
    const ctx = createCtx()
    ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ = '1'
    ctx.configs = [{
      adapters: createAdapters({
        opencode: {}
      })
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'opencode',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-opencode-native',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(createAdapterHookBridgeMock).toHaveBeenCalledWith(expect.objectContaining({
      adapter: 'opencode',
      disabledEvents: ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop']
    }))
  })

  it('prefers exact model selector metadata over service metadata for default adapter resolution', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        codex: {},
        'claude-code': {}
      }),
      models: {
        serviceA: {
          defaultAdapter: 'claude-code'
        },
        'serviceA,modelX': {
          defaultAdapter: 'codex'
        }
      },
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelX']
        }
      },
      defaultModelService: 'serviceA',
      defaultModel: 'modelX'
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-model-selector',
      onEvent: vi.fn()
    })

    expect(loadAdapterMock).toHaveBeenCalledWith('codex')
    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      model: 'serviceA,modelX'
    })
  })

  it('uses adapter-level defaultModel before falling back to global default model', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        codex: {
          defaultModel: 'serviceA,modelB'
        },
        'claude-code': {}
      }),
      defaultModel: 'serviceA,modelA',
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelA', 'modelB']
        }
      }
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-adapter-model',
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      model: 'serviceA,modelB'
    })
  })

  it('falls back to adapter defaultModel and emits a selection warning when rules reject the chosen model', async () => {
    const ctx = createCtx()
    const onEvent = vi.fn()
    queryMock.mockImplementation(async (_ctx, options) => {
      options.onEvent({
        type: 'init',
        data: {
          uuid: 'adapter-init',
          model: options.model ?? 'serviceA,modelA',
          version: '1.0.0',
          tools: [],
          slashCommands: [],
          cwd: '/tmp/project',
          agents: []
        }
      })
      return {
        kill: vi.fn(),
        emit: vi.fn()
      }
    })
    ctx.configs = [{
      adapters: createAdapters({
        codex: {
          defaultModel: 'serviceA,modelB',
          excludeModels: ['serviceA,modelA']
        }
      }),
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelA', 'modelB']
        }
      }
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-adapter-model-rules',
      model: 'serviceA,modelA',
      onEvent
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      model: 'serviceA,modelB'
    })
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'init',
      data: expect.objectContaining({
        selectionWarnings: [
          expect.objectContaining({
            adapter: 'codex',
            requestedModel: 'serviceA,modelA',
            resolvedModel: 'serviceA,modelB',
            reason: 'excluded'
          })
        ]
      })
    }))
  })

  it('throws when adapter rules reject the selected model and defaultModel is missing', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        codex: {
          includeModels: ['serviceB']
        }
      }),
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelA']
        },
        serviceB: {
          apiBaseUrl: 'https://service-b.example.com',
          apiKey: 'token-b',
          models: ['modelB']
        }
      }
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await expect(run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-adapter-model-rules-error',
      model: 'serviceA,modelA',
      onEvent: vi.fn()
    })).rejects.toThrow('Configure adapters.codex.defaultModel to continue')
  })

  it('prefers user config model selector metadata over project config', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        codex: {},
        'claude-code': {}
      }),
      models: {
        serviceA: {
          defaultAdapter: 'claude-code'
        }
      },
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelX']
        }
      },
      defaultModelService: 'serviceA',
      defaultModel: 'modelX'
    }, {
      models: {
        serviceA: {
          defaultAdapter: 'codex'
        }
      }
    }]
    prepareMock.mockResolvedValue([ctx])

    await run({
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-user-override',
      onEvent: vi.fn()
    })

    expect(loadAdapterMock).toHaveBeenCalledWith('codex')
  })
})
