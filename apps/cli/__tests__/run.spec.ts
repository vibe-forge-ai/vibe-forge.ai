import { describe, expect, it } from 'vitest'

import {
  createSessionExitController,
  getAdapterErrorMessage,
  getPrintableAssistantText,
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
})
