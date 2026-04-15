import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildConfigJsonVariables: vi.fn(),
  loadConfig: vi.fn(),
  resolveUseDefaultVibeForgeMcpServer: vi.fn(),
  resolveWorkspaceAssetBundle: vi.fn(),
  createLogger: vi.fn(),
  resolveServerLogLevel: vi.fn()
}))

vi.mock('@vibe-forge/config', () => ({
  buildConfigJsonVariables: mocks.buildConfigJsonVariables,
  loadConfig: mocks.loadConfig,
  resolveUseDefaultVibeForgeMcpServer: mocks.resolveUseDefaultVibeForgeMcpServer
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
    mocks.loadConfig.mockResolvedValue([undefined, undefined])
    mocks.resolveUseDefaultVibeForgeMcpServer.mockReturnValue(true)
    mocks.resolveWorkspaceAssetBundle.mockResolvedValue(undefined)
    mocks.resolveServerLogLevel.mockReturnValue('info')
    mocks.createLogger.mockReturnValue({
      stream: undefined,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
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
    expect(mocks.resolveWorkspaceAssetBundle).not.toHaveBeenCalled()
  })
})
