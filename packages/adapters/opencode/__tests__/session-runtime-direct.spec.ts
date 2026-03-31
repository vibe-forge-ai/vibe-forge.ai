import { execFile, spawn } from 'node:child_process'

import { describe, expect, it, vi } from 'vitest'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterOutputEvent } from '@vibe-forge/types'

import { createOpenCodeSession } from '#~/runtime/session.js'

import {
  flushAsyncWork,
  makeCtx,
  makeErrorProc,
  makeProc,
  mockExecFileJsonResponses,
  registerRuntimeTestHooks
} from './runtime-test-helpers'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn()
}))

const spawnMock = vi.mocked(spawn)
const execFileMock = vi.mocked(execFile)

describe('createOpenCodeSession direct runtime', () => {
  registerRuntimeTestHooks()

  it('emits exit in direct mode after the child process finishes', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_direct', title: 'Vibe Forge:session-direct', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ exitCode: 0 }))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-direct',
      description: 'say hi',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect((spawnMock.mock.calls[0]?.[2] as { stdio?: string }).stdio).toBe('inherit')
    expect(events).toEqual([{ type: 'exit', data: { exitCode: 0 } }])
  })

  it('does not inject a placeholder prompt in direct mode when description is missing', async () => {
    spawnMock.mockImplementation(() => makeProc({ exitCode: 0 }))

    const { ctx } = makeCtx()
    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-direct-empty',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toEqual([
      'run',
      '--format',
      'default',
      '--title',
      'Vibe Forge:session-direct-empty',
      '--dir',
      '/tmp'
    ])
  })

  it('injects the shared native hook bridge adapter env when opencode native hooks are enabled', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_native_hooks', title: 'Vibe Forge:session-native-hooks', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ exitCode: 0 }))

    const { ctx } = makeCtx({
      env: {
        __VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__: '1'
      }
    })

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-native-hooks',
      description: 'say hi',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }
    expect(spawnOptions.env?.__VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__).toBe('1')
    expect(spawnOptions.env?.[NATIVE_HOOK_BRIDGE_ADAPTER_ENV]).toBe('opencode')
  })

  it('emits exit in direct mode when the child process errors before launch', async () => {
    spawnMock.mockImplementation(() => makeErrorProc(new Error('opencode missing')))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-direct-error',
      description: 'say hi',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          message: 'opencode missing',
          fatal: true
        })
      }),
      { type: 'exit', data: { exitCode: 1, stderr: 'opencode missing' } }
    ])
  })

  it('resolves the latest session id before starting direct resume mode', async () => {
    mockExecFileJsonResponses(execFileMock, [{
      id: 'sess_latest',
      title: 'Vibe Forge:session-direct-resume',
      updatedAt: '2026-03-26T00:00:00.000Z'
    }], [{ id: 'sess_latest', title: 'Vibe Forge:session-direct-resume', updatedAt: '2026-03-26T00:00:01.000Z' }])
    spawnMock.mockImplementation(() => makeProc({ exitCode: 0 }))

    const events: AdapterOutputEvent[] = []
    const { ctx, cacheStore } = makeCtx({
      cacheSeed: {
        'adapter.opencode.session': {
          opencodeSessionId: 'sess_stale',
          title: 'Vibe Forge:session-direct-resume'
        }
      }
    })

    await createOpenCodeSession(ctx, {
      type: 'resume',
      runtime: 'cli',
      mode: 'direct',
      sessionId: 'session-direct-resume',
      description: 'continue',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toContain('sess_latest')
    expect(spawnMock.mock.calls[0]?.[1]).not.toContain('sess_stale')
    expect(cacheStore.get('adapter.opencode.session')).toMatchObject({
      opencodeSessionId: 'sess_latest',
      title: 'Vibe Forge:session-direct-resume'
    })
    expect(events).toEqual([{ type: 'exit', data: { exitCode: 0 } }])
  })
})
