import { spawn } from 'node:child_process'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

import { createCopilotSession } from '#~/runtime/session.js'

import { flushAsyncWork, makeCtx, makeProc, registerRuntimeTestHooks } from './runtime-test-helpers'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn()
}))

const spawnMock = vi.mocked(spawn)

describe('createCopilotSession official JSON parser', () => {
  registerRuntimeTestHooks()

  it('emits one final assistant message for official agent.message plus agent.completed streams', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: [
          JSON.stringify({
            type: 'session.created',
            sessionId: 'session-official'
          }),
          JSON.stringify({
            type: 'agent.message',
            data: {
              id: 'msg_official',
              content: [{ type: 'text', text: 'hello ' }]
            }
          }),
          JSON.stringify({
            type: 'tool.call',
            data: {
              id: 'tool_1',
              name: 'bash',
              arguments: { command: 'npm test' }
            }
          }),
          JSON.stringify({
            type: 'tool.result',
            data: {
              toolCallId: 'tool_1',
              result: 'passed'
            }
          }),
          JSON.stringify({
            type: 'agent.completed',
            data: {
              message: 'hello world'
            }
          }),
          JSON.stringify({
            type: 'unknown.future',
            data: {
              ok: true
            }
          })
        ].join('\n')
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-official',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          content: [expect.objectContaining({ type: 'tool_use', id: 'tool_1' })]
        })
      }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          content: [expect.objectContaining({ type: 'tool_result', tool_use_id: 'tool_1' })]
        })
      }),
      expect.objectContaining({ type: 'message', data: expect.objectContaining({ content: 'hello world' }) }),
      expect.objectContaining({ type: 'stop' })
    ])
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Ignoring unknown Copilot JSON event',
      expect.objectContaining({ type: 'unknown.future' })
    )
  })

  it('emits pending official agent.message content when no agent.completed event arrives', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: [
          JSON.stringify({
            type: 'agent.message',
            data: {
              id: 'msg_official_pending',
              content: [{ type: 'text', text: 'hello pending' }]
            }
          }),
          JSON.stringify({
            type: 'result',
            sessionId: 'session-official-pending',
            exitCode: 0
          })
        ].join('\n')
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-official-pending',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          id: 'msg_official_pending',
          content: 'hello pending'
        })
      }),
      expect.objectContaining({ type: 'stop' })
    ])
  })

  it('flushes pending official agent.message when agent.completed has no final text', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: [
          JSON.stringify({
            type: 'agent.message',
            data: {
              id: 'msg_completed_flush',
              content: [{ type: 'text', text: 'pending final' }]
            }
          }),
          JSON.stringify({
            type: 'agent.completed',
            data: {}
          }),
          JSON.stringify({
            type: 'tool.call',
            data: {
              id: 'tool_after_completed',
              name: 'bash',
              arguments: { command: 'echo late' }
            }
          })
        ].join('\n')
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-completed-flush',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          id: 'msg_completed_flush',
          content: 'pending final'
        })
      }),
      expect.objectContaining({
        type: 'message',
        data: expect.objectContaining({
          content: [expect.objectContaining({ type: 'tool_use', id: 'tool_after_completed' })]
        })
      }),
      expect.objectContaining({ type: 'stop' })
    ])
  })
})
