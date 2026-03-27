import { describe, expect, it, vi } from 'vitest'

import { prepareClaudeExecution } from '../src/runtime/prepare'

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
  it('falls back to create mode when no resume state exists', async () => {
    const result = await prepareClaudeExecution(createCtx(), {
      type: 'resume',
      runtime: 'server',
      sessionId,
      model: 'gpt-responses,gpt-5.2-codex-2026-01-14',
      onEvent: vi.fn()
    })

    expect(result.executionType).toBe('create')
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
    expect(result.args).toContain('--resume')
    expect(result.args).toContain(sessionId)
    expect(result.args).not.toContain('--session-id')
  })
})
