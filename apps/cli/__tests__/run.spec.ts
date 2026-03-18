import { describe, expect, it } from 'vitest'

import { getPrintableAssistantText, resolvePrintableStopText } from '#~/commands/run.js'

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
})
