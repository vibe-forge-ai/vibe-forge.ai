import { describe, expect, it } from 'vitest'

import { mapClaudeHookInputToVibeForge } from '#~/hooks/claude-runtime.js'

describe('Claude hook bridge helpers', () => {
  it('maps supported Claude native hooks into the unified hook shape', () => {
    const result = mapClaudeHookInputToVibeForge({
      cwd: '/tmp/project',
      sessionId: 'session-1',
      hookEventName: 'PreToolUse',
      toolName: 'Read',
      toolInput: {
        filePath: 'README.md'
      }
    })

    expect(result).toMatchObject({
      adapter: 'claude-code',
      hookSource: 'native',
      canBlock: true,
      hookEventName: 'PreToolUse',
      toolName: 'Read'
    })
  })

  it('skips Claude events that Vibe Forge keeps on the framework bridge', () => {
    const result = mapClaudeHookInputToVibeForge({
      cwd: '/tmp/project',
      sessionId: 'session-1',
      hookEventName: 'SessionEnd',
      reason: 'completed'
    })

    expect(result).toBeUndefined()
  })
})
