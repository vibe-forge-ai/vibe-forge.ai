import { PassThrough } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { createAdapterHookBridge } from '#~/bridge.js'
import type { HookLogger, HookBridgeSession } from '#~/index.js'
import type { ChatMessage } from '@vibe-forge/types'

const { callHookMock } = vi.hoisted(() => ({
  callHookMock: vi.fn()
}))

vi.mock('#~/call.js', () => ({
  callHook: callHookMock
}))

const flushAsyncWork = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const createLogger = (): HookLogger => ({
  stream: new PassThrough(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
})

describe('adapter hook bridge', () => {
  it('fires session start and initial prompt hooks with bridge metadata', async () => {
    const logger = createLogger()
    callHookMock.mockResolvedValue({ continue: true })

    const bridge = createAdapterHookBridge({
      ctx: {
        cwd: '/tmp/project',
        env: {},
        logger
      },
      adapter: 'codex',
      runtime: 'server',
      sessionId: 'session-1',
      type: 'create',
      model: 'gpt-5.4'
    })

    await bridge.start()
    const prompt = await bridge.prepareInitialPrompt('Ship it')

    expect(prompt).toBe('Ship it')
    expect(callHookMock).toHaveBeenNthCalledWith(
      1,
      'SessionStart',
      expect.objectContaining({
        adapter: 'codex',
        runtime: 'server',
        hookSource: 'bridge',
        canBlock: true,
        source: 'startup',
        model: 'gpt-5.4'
      }),
      {}
    )
    expect(callHookMock).toHaveBeenNthCalledWith(
      2,
      'UserPromptSubmit',
      expect.objectContaining({
        adapter: 'codex',
        runtime: 'server',
        hookSource: 'bridge',
        canBlock: true,
        prompt: 'Ship it'
      }),
      {}
    )
  })

  it('drops outgoing messages when a prompt hook blocks them', async () => {
    const logger = createLogger()
    callHookMock.mockResolvedValue({ continue: false, stopReason: 'blocked by policy' })

    const bridge = createAdapterHookBridge({
      ctx: {
        cwd: '/tmp/project',
        env: {},
        logger
      },
      adapter: 'claude-code',
      runtime: 'cli',
      sessionId: 'session-2',
      type: 'create'
    })

    const session: HookBridgeSession = {
      kill: vi.fn(),
      emit: vi.fn(),
      pid: 123
    }

    const wrapped = bridge.wrapSession(session)
    wrapped.emit({
      type: 'message',
      content: [{ type: 'text', text: 'blocked prompt' }]
    })

    await flushAsyncWork()

    expect(session.emit).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      '[HookBridge] Dropping outgoing message blocked by UserPromptSubmit hook',
      'blocked by policy'
    )
  })

  it('bridges tool lifecycle and stop/session end events from adapter output', async () => {
    const logger = createLogger()
    callHookMock.mockResolvedValue({ continue: true })

    const bridge = createAdapterHookBridge({
      ctx: {
        cwd: '/tmp/project',
        env: {},
        logger
      },
      adapter: 'codex',
      runtime: 'server',
      sessionId: 'session-3',
      type: 'resume'
    })

    const toolUseMessage: ChatMessage = {
      id: 'msg-tool-use',
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'tool-1',
        name: 'adapter:codex:Bash',
        input: { command: 'npm test' }
      }],
      createdAt: Date.now()
    }
    const toolResultMessage: ChatMessage = {
      id: 'msg-tool-result',
      role: 'assistant',
      content: [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'ok',
        is_error: false
      }],
      createdAt: Date.now()
    }
    const finalMessage: ChatMessage = {
      id: 'msg-final',
      role: 'assistant',
      content: 'All done',
      createdAt: Date.now()
    }

    bridge.handleOutput({ type: 'message', data: toolUseMessage })
    bridge.handleOutput({ type: 'message', data: toolResultMessage })
    bridge.handleOutput({ type: 'message', data: finalMessage })
    bridge.handleOutput({ type: 'stop', data: finalMessage })
    bridge.handleOutput({ type: 'exit', data: { exitCode: 0 } })

    await flushAsyncWork()

    expect(callHookMock).toHaveBeenCalledWith(
      'PreToolUse',
      expect.objectContaining({
        adapter: 'codex',
        hookSource: 'bridge',
        canBlock: false,
        toolCallId: 'tool-1',
        toolName: 'adapter:codex:Bash',
        toolInput: { command: 'npm test' }
      }),
      {}
    )
    expect(callHookMock).toHaveBeenCalledWith(
      'PostToolUse',
      expect.objectContaining({
        adapter: 'codex',
        hookSource: 'bridge',
        canBlock: false,
        toolCallId: 'tool-1',
        toolName: 'adapter:codex:Bash',
        toolInput: { command: 'npm test' },
        toolResponse: 'ok',
        isError: false
      }),
      {}
    )
    expect(callHookMock).toHaveBeenCalledWith(
      'Stop',
      expect.objectContaining({
        adapter: 'codex',
        hookSource: 'bridge',
        canBlock: false,
        lastAssistantMessage: 'All done'
      }),
      {}
    )
    expect(callHookMock).toHaveBeenCalledWith(
      'SessionEnd',
      expect.objectContaining({
        adapter: 'codex',
        hookSource: 'bridge',
        canBlock: false,
        reason: 'completed',
        lastAssistantMessage: 'All done'
      }),
      {}
    )
  })

  it('skips bridge-native events when the adapter enables native hooks', async () => {
    const logger = createLogger()
    callHookMock.mockClear()
    callHookMock.mockResolvedValue({ continue: true })

    const bridge = createAdapterHookBridge({
      ctx: {
        cwd: '/tmp/project',
        env: {},
        logger
      },
      adapter: 'codex',
      runtime: 'server',
      sessionId: 'session-native',
      type: 'create',
      disabledEvents: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']
    })

    const prompt = await bridge.prepareInitialPrompt('native prompt')
    await bridge.start()

    bridge.handleOutput({
      type: 'message',
      data: {
        id: 'msg-native-tool',
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool-1',
          name: 'Bash',
          input: { command: 'pwd' }
        }],
        createdAt: Date.now()
      }
    })
    bridge.handleOutput({
      type: 'stop',
      data: {
        id: 'msg-native-stop',
        role: 'assistant',
        content: 'done',
        createdAt: Date.now()
      }
    })
    bridge.handleOutput({ type: 'exit', data: { exitCode: 0 } })

    await flushAsyncWork()

    expect(prompt).toBe('native prompt')
    expect(callHookMock).toHaveBeenCalledTimes(1)
    expect(callHookMock).toHaveBeenCalledWith(
      'SessionEnd',
      expect.objectContaining({
        adapter: 'codex',
        hookSource: 'bridge',
        reason: 'completed'
      }),
      {}
    )
  })
})
