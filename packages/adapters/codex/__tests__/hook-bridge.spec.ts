import { describe, expect, it } from 'vitest'

import { mapCodexHookInputToVibeForge, mapVibeForgeHookOutputToCodex } from '../src/hook-bridge'

describe('codex native hook bridge helpers', () => {
  it('maps Codex native hooks into the unified hook shape', () => {
    const result = mapCodexHookInputToVibeForge({
      cwd: '/tmp/project',
      sessionId: 'session-1',
      transcriptPath: '/tmp/transcript.jsonl',
      hookEventName: 'PostToolUse',
      turnId: 'turn-1',
      toolUseId: 'tool-1',
      toolName: 'Bash',
      toolInput: {
        command: 'cat README.md'
      },
      toolResponse: {
        content: 'hello'
      }
    })

    expect(result).toMatchObject({
      adapter: 'codex',
      hookSource: 'native',
      canBlock: true,
      transcriptPath: '/tmp/transcript.jsonl',
      turnId: 'turn-1',
      hookEventName: 'PostToolUse',
      toolCallId: 'tool-1',
      toolName: 'Bash'
    })
  })

  it('maps blocked Vibe Forge output back into Codex pre-tool decision fields', () => {
    const result = mapVibeForgeHookOutputToCodex('PreToolUse', {
      continue: false,
      stopReason: 'blocked'
    })

    expect(result).toMatchObject({
      decision: 'block',
      reason: 'blocked',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'blocked'
      }
    })
    expect(result).not.toHaveProperty('continue')
  })

  it('keeps Stop continue semantics instead of converting them into continuation prompts', () => {
    const result = mapVibeForgeHookOutputToCodex('Stop', {
      continue: false,
      stopReason: 'stop here'
    })

    expect(result).toMatchObject({
      continue: false,
      stopReason: 'stop here'
    })
    expect(result).not.toHaveProperty('decision')
  })

  it('passes UserPromptSubmit additional context through the documented hook-specific output', () => {
    const result = mapVibeForgeHookOutputToCodex('UserPromptSubmit', {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'Ask for a clearer reproduction before editing files.'
      }
    })

    expect(result).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'Ask for a clearer reproduction before editing files.'
      }
    })
  })
})
