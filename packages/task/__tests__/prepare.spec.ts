import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  buildConfigJsonVariables: vi.fn(),
  loadConfigState: vi.fn(),
  mergeConfigs: vi.fn(),
  resolveUseDefaultVibeForgeMcpServer: vi.fn(),
  resolveWorkspaceAssetBundle: vi.fn(),
  syncConfiguredMarketplacePlugins: vi.fn(),
  createLogger: vi.fn(),
  resolveServerLogLevel: vi.fn(),
  logger: {
    stream: undefined,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@vibe-forge/config', () => ({
  buildConfigJsonVariables: mocks.buildConfigJsonVariables,
  loadConfigState: mocks.loadConfigState,
  mergeConfigs: mocks.mergeConfigs,
  resolveUseDefaultVibeForgeMcpServer: mocks.resolveUseDefaultVibeForgeMcpServer
}))

vi.mock('@vibe-forge/managed-plugins', () => ({
  syncConfiguredMarketplacePlugins: mocks.syncConfiguredMarketplacePlugins
}))

vi.mock('@vibe-forge/workspace-assets', () => ({
  resolveWorkspaceAssetBundle: mocks.resolveWorkspaceAssetBundle
}))

vi.mock('@vibe-forge/utils/create-logger', () => ({
  createLogger: mocks.createLogger
}))

vi.mock('@vibe-forge/utils/log-level', () => ({
  resolveServerLogLevel: mocks.resolveServerLogLevel
}))

describe('prepare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildConfigJsonVariables.mockReturnValue({})
    mocks.loadConfigState.mockResolvedValue({
      projectConfig: undefined,
      userConfig: undefined,
      mergedConfig: {}
    })
    mocks.mergeConfigs.mockImplementation((
      left: Record<string, unknown> | undefined,
      right: Record<string, unknown> | undefined
    ) => ({
      ...(left ?? {}),
      ...(right ?? {})
    }))
    mocks.resolveUseDefaultVibeForgeMcpServer.mockReturnValue(true)
    mocks.resolveWorkspaceAssetBundle.mockResolvedValue(undefined)
    mocks.syncConfiguredMarketplacePlugins.mockResolvedValue([])
    mocks.resolveServerLogLevel.mockReturnValue('info')
    mocks.createLogger.mockReturnValue(mocks.logger)
  })

  it('stores the resolved permission mode in env for nested runtimes', async () => {
    const { prepare } = await import('#~/prepare.js')

    const [ctx] = await prepare({
      cwd: '/tmp/project',
      env: {}
    }, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-parent',
      permissionMode: 'dontAsk',
      onEvent: vi.fn()
    } as any)

    expect(ctx.env.__VF_PROJECT_AI_PERMISSION_MODE__).toBe('dontAsk')
    expect(ctx.configState).toEqual({
      projectConfig: undefined,
      userConfig: undefined,
      mergedConfig: {}
    })
  })

  it('preserves an inherited permission mode when the current run does not override it', async () => {
    const { prepare } = await import('#~/prepare.js')

    const [ctx] = await prepare({
      cwd: '/tmp/project',
      env: {
        __VF_PROJECT_AI_PERMISSION_MODE__: 'plan'
      }
    }, {
      type: 'create',
      runtime: 'mcp',
      sessionId: 'session-child',
      onEvent: vi.fn()
    } as any)

    expect(ctx.env.__VF_PROJECT_AI_PERMISSION_MODE__).toBe('plan')
  })

  it('enables builtin permission hooks for mcp runtimes', async () => {
    const { prepare } = await import('#~/prepare.js')

    const [ctx] = await prepare({
      cwd: '/tmp/project',
      env: {}
    }, {
      type: 'create',
      runtime: 'mcp',
      sessionId: 'session-mcp',
      onEvent: vi.fn()
    } as any)

    expect(ctx.env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__).toBe('1')
  })

  it('syncs declared marketplace plugins before resolving workspace assets on create', async () => {
    const { prepare } = await import('#~/prepare.js')
    const marketplaces = {
      'team-tools': {
        type: 'claude-code',
        plugins: {
          reviewer: {
            scope: 'review'
          }
        }
      }
    }
    mocks.loadConfigState.mockResolvedValue({
      projectConfig: undefined,
      userConfig: undefined,
      mergedConfig: { marketplaces }
    })
    mocks.syncConfiguredMarketplacePlugins.mockResolvedValue([
      {
        marketplace: 'team-tools',
        plugin: 'reviewer',
        action: 'installed'
      }
    ])

    await prepare({
      cwd: '/tmp/project',
      env: {}
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-create',
      onEvent: vi.fn()
    } as any)

    expect(mocks.syncConfiguredMarketplacePlugins).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      marketplaces
    })
    expect(mocks.resolveWorkspaceAssetBundle).toHaveBeenCalledOnce()
    expect(mocks.logger.info).toHaveBeenCalledWith(
      { plugins: ['reviewer@team-tools'] },
      '[plugins] Synchronized declared marketplace plugins'
    )
  })

  it('does not sync declared marketplace plugins when resuming a session', async () => {
    const { prepare } = await import('#~/prepare.js')
    mocks.loadConfigState.mockResolvedValue({
      projectConfig: undefined,
      userConfig: undefined,
      mergedConfig: {
        marketplaces: {
          'team-tools': {
            type: 'claude-code'
          }
        }
      }
    })

    await prepare({
      cwd: '/tmp/project',
      env: {}
    }, {
      type: 'resume',
      runtime: 'cli',
      sessionId: 'session-resume',
      onEvent: vi.fn()
    } as any)

    expect(mocks.syncConfiguredMarketplacePlugins).not.toHaveBeenCalled()
  })

  it('reuses the provided asset bundle instead of resolving it again', async () => {
    const { prepare } = await import('#~/prepare.js')
    const assetBundle = {
      cwd: '/tmp/project',
      pluginInstances: [],
      assets: [],
      rules: [],
      specs: [],
      entities: [],
      skills: [],
      workspaces: [],
      mcpServers: {},
      hookPlugins: [],
      opencodeOverlayAssets: [],
      defaultIncludeMcpServers: [],
      defaultExcludeMcpServers: []
    }

    const [ctx] = await prepare({
      cwd: '/tmp/project',
      env: {},
      plugins: [
        { id: '/tmp/project/vendor/plugin' }
      ]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-assets',
      assetBundle,
      onEvent: vi.fn()
    } as any)

    expect(ctx.assets).toBe(assetBundle)
    expect(mocks.syncConfiguredMarketplacePlugins).not.toHaveBeenCalled()
    expect(mocks.resolveWorkspaceAssetBundle).not.toHaveBeenCalled()
  })

  it('merges run-scoped plugins with project config plugins when resolving assets', async () => {
    const { prepare } = await import('#~/prepare.js')
    mocks.loadConfigState.mockResolvedValue({
      projectConfig: {
        plugins: [
          { id: 'logger' }
        ]
      },
      userConfig: {
        plugins: [
          { id: 'standard-dev', scope: 'std' }
        ]
      },
      mergedConfig: {
        plugins: [
          { id: 'logger' },
          { id: 'standard-dev', scope: 'std' }
        ]
      }
    })
    mocks.mergeConfigs.mockImplementation((
      left: { plugins?: any[] } | undefined,
      right: { plugins?: any[] } | undefined
    ) => ({
      ...(left ?? {}),
      ...(right ?? {}),
      ...(left?.plugins != null || right?.plugins != null
        ? {
          plugins: [
            ...((left?.plugins as any[]) ?? []),
            ...((right?.plugins as any[]) ?? [])
          ]
        }
        : {})
    }))

    await prepare({
      cwd: '/tmp/project',
      env: {},
      plugins: [
        { id: '@vibe-forge/plugin-cli-skills' }
      ]
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-plugin-merge',
      onEvent: vi.fn()
    } as any)

    expect(mocks.resolveWorkspaceAssetBundle).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/project',
      configs: [
        {
          plugins: [{ id: 'logger' }]
        },
        {
          plugins: [{ id: 'standard-dev', scope: 'std' }]
        }
      ],
      plugins: [
        { id: 'logger' },
        { id: 'standard-dev', scope: 'std' },
        { id: '@vibe-forge/plugin-cli-skills' }
      ]
    }))
  })
})
