import { describe, expect, it } from 'vitest'

import { mapGeminiHookInputToVibeForge, mapVibeForgeHookOutputToGemini } from '../src/hook-bridge'

describe('gemini native hook bridge helpers', () => {
  it('maps Gemini native hooks into the unified hook shape', () => {
    const result = mapGeminiHookInputToVibeForge({
      cwd: '/tmp/project',
      sessionId: 'session-1',
      transcriptPath: '/tmp/transcript.jsonl',
      hookEventName: 'AfterTool',
      toolName: 'run_shell_command',
      toolInput: {
        command: 'cat README.md'
      },
      toolResponse: {
        content: 'hello'
      }
    })

    expect(result).toMatchObject({
      adapter: 'gemini',
      hookSource: 'native',
      canBlock: true,
      transcriptPath: '/tmp/transcript.jsonl',
      hookEventName: 'PostToolUse',
      toolName: 'run_shell_command'
    })
  })

  it('maps Gemini PreCompress into unified PreCompact with blockable semantics', () => {
    const result = mapGeminiHookInputToVibeForge({
      cwd: '/tmp/project',
      sessionId: 'session-1',
      hookEventName: 'PreCompress'
    })

    expect(result).toMatchObject({
      adapter: 'gemini',
      hookSource: 'native',
      canBlock: true,
      hookEventName: 'PreCompact'
    })
  })

  it('maps blocked Vibe Forge output back into Gemini before-tool decision fields', () => {
    const result = mapVibeForgeHookOutputToGemini('BeforeTool', {
      continue: false,
      stopReason: 'blocked'
    })

    expect(result).toMatchObject({
      decision: 'deny',
      reason: 'blocked'
    })
    expect(result).not.toHaveProperty('continue')
  })

  it('keeps AfterAgent non-blocking even when the unified Stop hook requests a stop', () => {
    const result = mapVibeForgeHookOutputToGemini('AfterAgent', {
      continue: false,
      stopReason: 'stop here'
    })

    expect(result).toMatchObject({
      systemMessage: 'stop here'
    })
    expect(result).not.toHaveProperty('continue')
    expect(result).not.toHaveProperty('decision')
  })

  it('passes BeforeAgent additional context through Gemini hook-specific output', () => {
    const result = mapVibeForgeHookOutputToGemini('BeforeAgent', {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: 'Ask for a clearer reproduction before editing files.'
      }
    })

    expect(result).toMatchObject({
      hookSpecificOutput: {
        additionalContext: 'Ask for a clearer reproduction before editing files.'
      }
    })
  })

  it('passes unified PreCompact output back to Gemini PreCompress fields', () => {
    const result = mapVibeForgeHookOutputToGemini('PreCompress', {
      continue: false,
      stopReason: 'compact later'
    })

    expect(result).toMatchObject({
      continue: false,
      stopReason: 'compact later'
    })
  })
})
