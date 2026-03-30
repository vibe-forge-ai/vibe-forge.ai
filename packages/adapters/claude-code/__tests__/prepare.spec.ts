import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'

const mocks = vi.hoisted(() => ({
  ensureClaudeCodeRouterReady: vi.fn()
}))

vi.mock('../src/ccr/daemon', () => ({
  ensureClaudeCodeRouterReady: mocks.ensureClaudeCodeRouterReady
}))

import { prepareClaudeExecution } from '../src/claude/prepare'

const sessionId = '6cd99e50-d3be-4070-b408-8133cfc42750'

const createCtx = (resumeState?: { canResume: boolean }) =>
  ({
    ctxId: 'test-ctx',
    cwd: '/tmp/workspace',
    env: {},
    cache: {
      get: vi.fn(async (key: string) => (
        key === 'adapter.claude-code.resume-state' ? resumeState : undefined
      )),
      set: vi.fn(async () => ({ cachePath: '/tmp/cache.json' }))
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    configs: [undefined, undefined]
  }) as any

describe('prepareClaudeExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensureClaudeCodeRouterReady.mockResolvedValue({
      host: '127.0.0.1',
      port: 4123,
      apiKey: 'router-key',
      apiTimeoutMs: 120000
    })
  })

  it('falls back to create mode when no resume state exists', async () => {
    const result = await prepareClaudeExecution(createCtx(), {
      type: 'resume',
      runtime: 'server',
      sessionId,
      model: 'gpt-responses,gpt-5.2-codex-2026-01-14',
      onEvent: vi.fn()
    })

    expect(result.executionType).toBe('create')
    expect(result.cliPath).toBe('claude')
    expect(result.args).toContain('--session-id')
    expect(result.args).toContain(sessionId)
    expect(result.args).not.toContain('--resume')
  })

  it('keeps resume mode when the session has been initialized before', async () => {
    const result = await prepareClaudeExecution(createCtx({ canResume: true }), {
      type: 'resume',
      runtime: 'server',
      sessionId,
      model: 'gpt-responses,gpt-5.2-codex-2026-01-14',
      onEvent: vi.fn()
    })

    expect(result.executionType).toBe('resume')
    expect(result.cliPath).toBe('claude')
    expect(result.args).toContain('--resume')
    expect(result.args).toContain(sessionId)
    expect(result.args).not.toContain('--session-id')
  })

  it('routes service-qualified models through the reusable CCR daemon via settings env only', async () => {
    const ctx = createCtx()

    const result = await prepareClaudeExecution(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId,
      model: 'gpt-responses,gpt-5.2-codex-2026-01-14',
      onEvent: vi.fn()
    })

    expect(result.cliPath).toBe('claude')
    expect(result.args).toContain('--model')
    expect(result.args).toContain('gpt-responses,gpt-5.2-codex-2026-01-14')
    expect(result.env.ANTHROPIC_BASE_URL).toBeUndefined()
    expect(result.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(mocks.ensureClaudeCodeRouterReady).toHaveBeenCalledWith(ctx)
    expect(ctx.cache.set).toHaveBeenCalledWith(
      'adapter.claude-code.settings',
      expect.objectContaining({
        env: expect.objectContaining({
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:4123',
          ANTHROPIC_AUTH_TOKEN: 'router-key',
          ANTHROPIC_API_KEY: '',
          API_TIMEOUT_MS: '120000'
        })
      })
    )
  })

  it('keeps native Claude execution untouched for non-CCR models', async () => {
    const ctx = createCtx()

    await prepareClaudeExecution(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId,
      model: 'claude-sonnet-4-20250514',
      onEvent: vi.fn()
    })

    expect(mocks.ensureClaudeCodeRouterReady).not.toHaveBeenCalled()
    expect(ctx.cache.set).toHaveBeenCalledWith(
      'adapter.claude-code.settings',
      expect.objectContaining({
        env: expect.not.objectContaining({
          ANTHROPIC_BASE_URL: expect.any(String),
          ANTHROPIC_AUTH_TOKEN: expect.any(String),
          ANTHROPIC_API_KEY: expect.any(String),
          API_TIMEOUT_MS: expect.any(String)
        })
      })
    )
  })

  it('injects the shared native hook bridge adapter env when claude native hooks are enabled', async () => {
    const ctx = createCtx()
    ctx.env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ = '1'

    const result = await prepareClaudeExecution(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId,
      onEvent: vi.fn()
    })

    expect(result.env[NATIVE_HOOK_BRIDGE_ADAPTER_ENV]).toBe('claude-code')
    expect(ctx.cache.set).toHaveBeenCalledWith(
      'adapter.claude-code.settings',
      expect.objectContaining({
        env: expect.objectContaining({
          [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude-code'
        })
      })
    )
  })
})
