import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'

import {
  createSessionExitController,
  getAdapterErrorMessage,
  getPrintableAssistantText,
  handlePrintEvent,
  registerRunCommand,
  resolveInjectDefaultSystemPromptOption,
  resolvePrintableStopText
} from '#~/commands/run.js'

describe('run command print output', () => {
  it('extracts printable assistant text from string content', () => {
    expect(getPrintableAssistantText({
      id: 'msg-1',
      role: 'assistant',
      content: 'hello',
      createdAt: Date.now()
    })).toBe('hello')
  })

  it('ignores non-text assistant messages when choosing printable content', () => {
    expect(getPrintableAssistantText({
      id: 'msg-2',
      role: 'assistant',
      content: [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'done'
      }],
      createdAt: Date.now()
    })).toBeUndefined()
  })

  it('falls back to the last assistant text when stop has no message payload', () => {
    expect(resolvePrintableStopText(undefined, 'final answer')).toBe('final answer')
  })

  it('formats adapter error details for text output', () => {
    expect(getAdapterErrorMessage({
      message: 'Incomplete response returned',
      details: { reason: 'max_output_tokens' },
      fatal: true
    })).toContain('"reason": "max_output_tokens"')
  })

  it('treats commander default values as no CLI override for negative boolean flags', () => {
    expect(resolveInjectDefaultSystemPromptOption(true, 'default')).toBeUndefined()
    expect(resolveInjectDefaultSystemPromptOption(false, 'cli')).toBe(false)
  })

  it('defers process exit until the session handle is bound', () => {
    const calls: number[] = []
    const controller = createSessionExitController({
      exit: (code) => {
        calls.push(code)
      }
    })
    let killCount = 0

    controller.requestExit(1)
    expect(calls).toEqual([])

    controller.bindSession({
      kill: () => {
        killCount += 1
      }
    })

    expect(killCount).toBe(1)
    expect(calls).toEqual([1])
  })

  it('exits immediately when the session handle is already bound', () => {
    const calls: number[] = []
    let killCount = 0
    const controller = createSessionExitController({
      exit: (code) => {
        calls.push(code)
      }
    })

    controller.bindSession({
      kill: () => {
        killCount += 1
      }
    })
    controller.requestExit(0)

    expect(killCount).toBe(1)
    expect(calls).toEqual([0])
  })

  it('prints the last assistant text for text output mode on stop', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const stateAfterMessage = handlePrintEvent({
      event: {
        type: 'message',
        data: {
          id: 'msg-3',
          role: 'assistant',
          content: 'partial answer',
          createdAt: Date.now()
        }
      },
      outputFormat: 'text',
      lastAssistantText: undefined,
      didExitAfterError: false,
      log,
      errorLog,
      requestExit
    })

    expect(stateAfterMessage.lastAssistantText).toBe('partial answer')
    expect(log).not.toHaveBeenCalled()

    const stateAfterStop = handlePrintEvent({
      event: { type: 'stop' },
      outputFormat: 'text',
      lastAssistantText: stateAfterMessage.lastAssistantText,
      didExitAfterError: stateAfterMessage.didExitAfterError,
      log,
      errorLog,
      requestExit
    })

    expect(stateAfterStop.lastAssistantText).toBe('partial answer')
    expect(log).toHaveBeenCalledWith('partial answer')
    expect(requestExit).toHaveBeenCalledWith(0)
  })

  it('prints adapter errors for fatal text-mode failures', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const nextState = handlePrintEvent({
      event: {
        type: 'error',
        data: {
          message: 'fatal failure',
          details: { reason: 'network' },
          fatal: true
        }
      },
      outputFormat: 'text',
      lastAssistantText: 'previous answer',
      didExitAfterError: false,
      log,
      errorLog,
      requestExit
    })

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('fatal failure'))
    expect(requestExit).toHaveBeenCalledWith(1)
    expect(nextState.didExitAfterError).toBe(true)
  })

  it('prints the stop payload as JSON for json output mode', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const stateAfterMessage = handlePrintEvent({
      event: {
        type: 'message',
        data: {
          id: 'msg-4',
          role: 'assistant',
          content: 'ignored before stop',
          createdAt: Date.now()
        }
      },
      outputFormat: 'json',
      lastAssistantText: undefined,
      didExitAfterError: false,
      log,
      errorLog,
      requestExit
    })

    expect(stateAfterMessage.lastAssistantText).toBe('ignored before stop')
    expect(log).not.toHaveBeenCalled()

    handlePrintEvent({
      event: {
        type: 'stop',
        data: {
          id: 'msg-5',
          role: 'assistant',
          content: 'final answer',
          createdAt: Date.now()
        }
      },
      outputFormat: 'json',
      lastAssistantText: stateAfterMessage.lastAssistantText,
      didExitAfterError: stateAfterMessage.didExitAfterError,
      log,
      errorLog,
      requestExit
    })

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[0]).toContain('"type": "stop"')
    expect(log.mock.calls[0]?.[0]).toContain('"final answer"')
    expect(requestExit).toHaveBeenCalledWith(0)
  })

  it('streams every event as JSON for stream-json output mode without suppressing stop', () => {
    const log = vi.fn()
    const errorLog = vi.fn()
    const requestExit = vi.fn()

    const stateAfterInit = handlePrintEvent({
      event: {
        type: 'init',
        data: {
          uuid: 'session-1',
          model: 'mock-model',
          version: 'test',
          tools: [],
          slashCommands: [],
          cwd: '/tmp/project',
          agents: []
        }
      },
      outputFormat: 'stream-json',
      lastAssistantText: undefined,
      didExitAfterError: false,
      log,
      errorLog,
      requestExit
    })

    expect(stateAfterInit.lastAssistantText).toBeUndefined()

    const stateAfterMessage = handlePrintEvent({
      event: {
        type: 'message',
        data: {
          id: 'msg-6',
          role: 'assistant',
          content: 'stream body',
          createdAt: Date.now()
        }
      },
      outputFormat: 'stream-json',
      lastAssistantText: stateAfterInit.lastAssistantText,
      didExitAfterError: stateAfterInit.didExitAfterError,
      log,
      errorLog,
      requestExit
    })

    handlePrintEvent({
      event: { type: 'stop' },
      outputFormat: 'stream-json',
      lastAssistantText: stateAfterMessage.lastAssistantText,
      didExitAfterError: stateAfterMessage.didExitAfterError,
      log,
      errorLog,
      requestExit
    })

    expect(stateAfterMessage.lastAssistantText).toBe('stream body')
    expect(log).toHaveBeenCalledTimes(3)
    expect(log.mock.calls[0]?.[0]).toContain('"type": "init"')
    expect(log.mock.calls[1]?.[0]).toContain('"type": "message"')
    expect(log.mock.calls[2]?.[0]).toContain('"type": "stop"')
    expect(requestExit).not.toHaveBeenCalled()
  })

  it('rejects unsupported output format values at parse time', async () => {
    const program = new Command()
    program.exitOverride()
    program.configureOutput({
      writeErr: () => {}
    })
    registerRunCommand(program)

    await expect(program.parseAsync([
      'node',
      'vf',
      '--output-format',
      'invalid-format'
    ], { from: 'user' })).rejects.toMatchObject({
      code: 'commander.invalidArgument'
    })
  })
})
