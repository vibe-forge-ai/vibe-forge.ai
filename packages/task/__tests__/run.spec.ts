import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '#~/run.js'
import type { AdapterCtx, WorkspaceAssetBundle } from '@vibe-forge/types'
import type { Logger } from '@vibe-forge/utils/create-logger'

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

vi.mock('#~/prepare.js', () => ({
  prepare: prepareMock
}))

vi.mock('@vibe-forge/types', () => ({
  loadAdapter: loadAdapterMock
}))

vi.mock('@vibe-forge/hooks', () => ({
  callHook: callHookMock,
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
  pluginConfigs: undefined,
  pluginInstances: [],
  assets: [],
  rules: [],
  specs: [],
  entities: [],
  skills: [],
  mcpServers: {},
  hookPlugins: [],
  opencodeOverlayAssets: [],
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
  ] as unknown as AdapterCtx['configs'],
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

  it('returns the resolved adapter used for the session', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        codex: {},
        'claude-code': {}
      }),
      defaultAdapter: 'claude-code'
    }, undefined] as unknown as AdapterCtx['configs']
    prepareMock.mockResolvedValue([ctx])

    const result = await run({
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-resolved-adapter',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(result.resolvedAdapter).toBe('claude-code')
  })

  it('resolves effort with explicit > model > adapter > config precedence', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      effort: 'low',
      adapters: createAdapters({
        codex: {
          effort: 'medium'
        }
      }),
      models: {
        'serviceA,modelX': {
          effort: 'high'
        }
      },
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelX']
        }
      }
    }, undefined] as unknown as AdapterCtx['configs']
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-effort',
      model: 'serviceA,modelX',
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      effort: 'high'
    })

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-effort-explicit',
      model: 'serviceA,modelX',
      effort: 'max',
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[1]?.[1]).toMatchObject({
      effort: 'max'
    })
  })

  it('accepts effort for kimi and forwards it to the adapter query', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        kimi: {
          effort: 'medium'
        }
      })
    }, undefined] as AdapterCtx['configs']
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'kimi',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-kimi-effort',
      effort: 'high',
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls.at(-1)?.[1]).toMatchObject({
      effort: 'high'
    })
  })

  it('attaches the adapter asset plan to query options', async () => {
    const ctx = createCtx()
    const skillAsset = {
      id: 'skill:workspace:workspace:research:.ai/skills/research/SKILL.md',
      kind: 'skill' as const,
      name: 'research',
      displayName: 'research',
      origin: 'workspace' as const,
      sourcePath: '/tmp/project/.ai/skills/research/SKILL.md',
      payload: {
        definition: {
          path: '/tmp/project/.ai/skills/research/SKILL.md',
          body: '阅读 README.md',
          attributes: {}
        }
      }
    }
    const commandAsset = {
      id: 'command:plugin:0:demo/review:node_modules/@vibe-forge/plugin-demo/opencode/commands/review.md',
      kind: 'command' as const,
      name: 'review',
      displayName: 'demo/review',
      scope: 'demo',
      origin: 'plugin' as const,
      sourcePath: '/tmp/project/node_modules/@vibe-forge/plugin-demo/opencode/commands/review.md',
      instancePath: '0',
      packageId: '@vibe-forge/plugin-demo',
      resolvedBy: 'vibe-forge-prefix',
      payload: {
        entryName: 'review',
        targetSubpath: 'commands/review.md'
      }
    }
    ctx.assets.assets = [skillAsset, commandAsset]
    ctx.assets.skills = [skillAsset]
    ctx.assets.opencodeOverlayAssets = [commandAsset]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-assets',
      promptAssetIds: [skillAsset.id],
      onEvent: vi.fn()
    })

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        adapter: 'codex',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            assetId: skillAsset.id,
            status: 'prompt'
          }),
          expect.objectContaining({
            assetId: commandAsset.id,
            status: 'skipped'
          })
        ])
      }
    })
  })

  it('merges runtime MCP servers into the adapter asset plan', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-runtime-mcp',
      runtimeMcpServers: {
        'channel-lark-default': {
          command: process.execPath,
          args: ['/tmp/channel-lark-mcp.js'],
          env: {
            VF_LARK_APP_ID: 'cli_app'
          }
        }
      },
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        mcpServers: {
          'channel-lark-default': {
            command: process.execPath,
            args: ['/tmp/channel-lark-mcp.js'],
            env: {
              VF_LARK_APP_ID: 'cli_app'
            }
          }
        }
      }
    })
  })

  it('does not inject runtime MCP servers when explicit MCP include filters select other servers', async () => {
    const ctx = createCtx()
    ctx.assets.mcpServers.docs = {
      id: 'mcp-docs',
      kind: 'mcpServer',
      name: 'docs',
      displayName: 'docs',
      origin: 'workspace',
      sourcePath: '/tmp/project/.ai/mcp/docs.json',
      payload: {
        name: 'docs',
        config: {
          command: process.execPath,
          args: ['/tmp/docs-mcp.js']
        }
      }
    }
    ctx.assets.assets.push(ctx.assets.mcpServers.docs)
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-runtime-mcp-restricted',
      mcpServers: {
        include: ['docs']
      },
      runtimeMcpServers: {
        'channel-lark-default': {
          command: process.execPath,
          args: ['/tmp/channel-lark-mcp.js']
        }
      },
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        mcpServers: {
          docs: {
            command: process.execPath,
            args: ['/tmp/docs-mcp.js']
          }
        }
      }
    })
    expect(queryMock.mock.calls[0]?.[1]?.assetPlan?.mcpServers).not.toHaveProperty('channel-lark-default')
  })

  it('allows runtime MCP servers to be explicitly included by name', async () => {
    const ctx = createCtx()
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-runtime-mcp-include-runtime',
      mcpServers: {
        include: ['channel-lark-default']
      },
      runtimeMcpServers: {
        'channel-lark-default': {
          command: process.execPath,
          args: ['/tmp/channel-lark-mcp.js']
        }
      },
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        mcpServers: {
          'channel-lark-default': {
            command: process.execPath,
            args: ['/tmp/channel-lark-mcp.js']
          }
        }
      }
    })
  })

  it('does not let runtime MCP servers shadow workspace MCP servers with the same name', async () => {
    const ctx = createCtx()
    ctx.assets.mcpServers['channel-lark-default'] = {
      id: 'mcp-1',
      kind: 'mcpServer',
      name: 'channel-lark-default',
      displayName: 'channel-lark-default',
      origin: 'workspace',
      sourcePath: '/tmp/project/.ai/mcp/channel-lark-default.json',
      payload: {
        name: 'channel-lark-default',
        config: {
          command: process.execPath,
          args: ['/tmp/workspace-mcp.js']
        }
      }
    }
    ctx.assets.assets.push(ctx.assets.mcpServers['channel-lark-default'])
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'codex',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-runtime-mcp-shadow',
      runtimeMcpServers: {
        'channel-lark-default': {
          command: process.execPath,
          args: ['/tmp/channel-lark-mcp.js']
        }
      },
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      assetPlan: {
        mcpServers: {
          'channel-lark-default': {
            command: process.execPath,
            args: ['/tmp/workspace-mcp.js']
          }
        }
      }
    })
    expect(ctx.logger.warn).toHaveBeenCalledWith({
      runtimeMcpServerNames: ['channel-lark-default']
    }, '[mcp] Ignoring session companion MCP servers that would shadow workspace MCP servers')
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

  it('disables overlapping bridge events when kimi native hooks are active', async () => {
    const ctx = createCtx()
    ctx.env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ = '1'
    ctx.configs = [{
      adapters: createAdapters({
        kimi: {}
      })
    }, undefined] as AdapterCtx['configs']
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'kimi',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-kimi-native',
      description: 'hello',
      onEvent: vi.fn()
    })

    expect(createAdapterHookBridgeMock).toHaveBeenCalledWith(expect.objectContaining({
      adapter: 'kimi',
      disabledEvents: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']
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

  it('allows the literal default model even when includeModels is configured', async () => {
    const ctx = createCtx()
    ctx.configs = [{
      adapters: createAdapters({
        opencode: {
          includeModels: ['serviceA']
        }
      }),
      modelServices: {
        serviceA: {
          apiBaseUrl: 'https://service-a.example.com',
          apiKey: 'token-a',
          models: ['modelA']
        }
      }
    }, undefined]
    prepareMock.mockResolvedValue([ctx])

    await run({
      adapter: 'opencode',
      cwd: ctx.cwd,
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-default-model-allowed',
      model: 'default',
      onEvent: vi.fn()
    })

    expect(queryMock.mock.calls[0]?.[1]).toMatchObject({
      model: 'default'
    })
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
