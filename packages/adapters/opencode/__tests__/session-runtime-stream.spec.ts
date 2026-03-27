import { execFile, spawn } from 'node:child_process'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/core/adapter'

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

describe('createOpenCodeSession stream runtime', () => {
  registerRuntimeTestHooks()

  it('emits init, message, and stop for a successful stream turn', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_1', title: 'Vibe Forge:session-1', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'pong\n' }))

    const events: AdapterOutputEvent[] = []
    const { ctx, cacheStore } = makeCtx()

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-1',
      description: 'Reply with exactly pong.',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toEqual([
      'run',
      '--format',
      'default',
      '--title',
      'Vibe Forge:session-1',
      'Reply with exactly pong.'
    ])
    expect(events.map(event => event.type)).toEqual(['init', 'message', 'stop'])
    expect(events[1]).toMatchObject({ type: 'message', data: { role: 'assistant', content: 'pong' } })
    expect(cacheStore.get('adapter.opencode.session')).toMatchObject({
      opencodeSessionId: 'sess_1',
      title: 'Vibe Forge:session-1'
    })
  })

  it('reuses the cached OpenCode session id for later turns', async () => {
    mockExecFileJsonResponses(execFileMock, [{
      id: 'sess_1',
      title: 'Vibe Forge:session-stream',
      updatedAt: '2026-03-26T00:00:00.000Z'
    }], [{ id: 'sess_1', title: 'Vibe Forge:session-stream', updatedAt: '2026-03-26T00:01:00.000Z' }])
    spawnMock
      .mockImplementationOnce(() => makeProc({ stdout: 'first\n' }))
      .mockImplementationOnce(() => makeProc({ stdout: 'second\n' }))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()
    const session = await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-stream',
      description: 'first',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()
    session.emit({ type: 'message', content: [{ type: 'text', text: 'second' }] })
    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toContain('--title')
    expect(spawnMock.mock.calls[1]?.[1]).toContain('--session')
    expect(spawnMock.mock.calls[1]?.[1]).toContain('sess_1')
    expect(events.filter(event => event.type === 'message')).toHaveLength(2)
  })

  it('does not start a turn until a message arrives when create has no description', async () => {
    spawnMock.mockImplementation(() => makeProc({ stdout: 'later\n' }))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()
    const session = await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-empty-create',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()
    expect(spawnMock).not.toHaveBeenCalled()
    expect(events).toEqual([expect.objectContaining({ type: 'init' })])

    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_later', title: 'Vibe Forge:session-empty-create', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    session.emit({ type: 'message', content: [{ type: 'text', text: 'later' }] })

    await flushAsyncWork()
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock.mock.calls[0]?.[1]).toContain('later')
  })

  it('retries without the cached session id when resume hits a missing session', async () => {
    mockExecFileJsonResponses(execFileMock, [{
      id: 'sess_new',
      title: 'Vibe Forge:session-resume',
      updatedAt: '2026-03-26T00:00:00.000Z'
    }], [{ id: 'sess_new', title: 'Vibe Forge:session-resume', updatedAt: '2026-03-26T00:00:01.000Z' }])
    spawnMock
      .mockImplementationOnce(() => makeProc({ stderr: 'Error: session not found\n', exitCode: 1 }))
      .mockImplementationOnce(() => makeProc({ stdout: 'recovered\n' }))

    const events: AdapterOutputEvent[] = []
    const { ctx, cacheStore } = makeCtx({
      cacheSeed: {
        'adapter.opencode.session': {
          opencodeSessionId: 'sess_missing',
          title: 'Vibe Forge:session-resume'
        }
      }
    })

    await createOpenCodeSession(ctx, {
      type: 'resume',
      runtime: 'server',
      sessionId: 'session-resume',
      description: 'continue',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toContain('sess_missing')
    expect(spawnMock.mock.calls[1]?.[1]).toContain('sess_new')
    expect(events.some(event => event.type === 'exit')).toBe(false)
    expect(events.some(event => event.type === 'stop')).toBe(true)
    expect(cacheStore.get('adapter.opencode.session')).toMatchObject({
      opencodeSessionId: 'sess_new',
      title: 'Vibe Forge:session-resume'
    })
  })

  it('emits exit when a stream turn fails before the child process starts cleanly', async () => {
    spawnMock.mockImplementation(() => makeErrorProc(new Error('spawn failed')))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-stream-error',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          message: 'spawn failed',
          fatal: true
        })
      }),
      { type: 'exit', data: { exitCode: 1, stderr: 'spawn failed' } }
    ])
  })
})
