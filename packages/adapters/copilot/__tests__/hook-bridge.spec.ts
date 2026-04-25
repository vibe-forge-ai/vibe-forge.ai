import { describe, expect, it } from 'vitest'

import { mapCopilotHookInputToVibeForge, mapVibeForgeHookOutputToCopilot, supportsHookEvent } from '../src/hook-bridge'

describe('copilot native hook bridge helpers', () => {
  const withHookEventEnv = <T>(value: string | undefined, fn: () => T) => {
    const previous = process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__
    if (value == null) {
      delete process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__
    } else {
      process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__ = value
    }
    try {
      return fn()
    } finally {
      if (previous == null) {
        delete process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__
      } else {
        process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__ = previous
      }
    }
  }

  it('maps Copilot VS Code-compatible tool hooks into the unified hook shape', () => {
    const result = mapCopilotHookInputToVibeForge({
      hook_event_name: 'PreToolUse',
      session_id: 'copilot-session',
      timestamp: '2026-04-25T00:00:00.000Z',
      cwd: '/tmp/project',
      tool_name: 'bash',
      tool_input: {
        command: 'rm -rf dist'
      }
    })

    expect(result).toMatchObject({
      adapter: 'copilot',
      hookSource: 'native',
      canBlock: true,
      hookEventName: 'PreToolUse',
      sessionId: 'copilot-session',
      toolName: 'bash',
      toolInput: {
        command: 'rm -rf dist'
      }
    })
  })

  it('uses hook event env as fallback for official camelCase pre-tool payloads', () => {
    const result = withHookEventEnv('PreToolUse', () =>
      mapCopilotHookInputToVibeForge({
        sessionId: 'copilot-session',
        timestamp: 1777075200000,
        cwd: '/tmp/project',
        toolName: 'bash',
        toolArgs: '{"command":"npm test"}'
      }))

    expect(result).toMatchObject({
      adapter: 'copilot',
      hookEventName: 'PreToolUse',
      canBlock: true,
      toolName: 'bash',
      toolInput: {
        command: 'npm test'
      }
    })
  })

  it('uses hook event env as fallback for official camelCase post-tool payloads', () => {
    const result = withHookEventEnv('PostToolUse', () =>
      mapCopilotHookInputToVibeForge({
        sessionId: 'copilot-session',
        timestamp: 1777075200000,
        cwd: '/tmp/project',
        toolName: 'bash',
        toolArgs: '{"command":"npm test"}',
        toolResult: {
          resultType: 'success',
          textResultForLlm: 'passed'
        }
      }))

    expect(result).toMatchObject({
      adapter: 'copilot',
      hookEventName: 'PostToolUse',
      canBlock: false,
      toolResponse: {
        resultType: 'success',
        textResultForLlm: 'passed'
      }
    })
  })

  it('uses hook event env as fallback for official stop payloads', () => {
    const result = withHookEventEnv('Stop', () =>
      mapCopilotHookInputToVibeForge({
        sessionId: 'copilot-session',
        timestamp: 1777075200000,
        cwd: '/tmp/project'
      }))

    expect(result).toMatchObject({
      adapter: 'copilot',
      hookEventName: 'Stop',
      canBlock: true,
      sessionId: 'copilot-session'
    })
  })

  it('maps Copilot camelCase post-tool hooks into unified PostToolUse', () => {
    const result = mapCopilotHookInputToVibeForge({
      sessionId: 'copilot-session',
      timestamp: 1777075200000,
      cwd: '/tmp/project',
      hookEventName: 'postToolUse',
      toolName: 'bash',
      toolArgs: '{"command":"npm test"}',
      toolResult: {
        resultType: 'success',
        textResultForLlm: 'passed'
      }
    })

    expect(result).toMatchObject({
      adapter: 'copilot',
      hookEventName: 'PostToolUse',
      canBlock: false,
      toolName: 'bash',
      toolInput: {
        command: 'npm test'
      },
      toolResponse: {
        resultType: 'success',
        textResultForLlm: 'passed'
      }
    })
  })

  it('maps blocked Vibe Forge output back into Copilot pre-tool decisions', () => {
    expect(mapVibeForgeHookOutputToCopilot('PreToolUse', {
      continue: false,
      stopReason: 'blocked'
    })).toEqual({
      permissionDecision: 'deny',
      permissionDecisionReason: 'blocked'
    })
  })

  it('maps Stop blocking into Copilot agentStop continuation fields', () => {
    expect(mapVibeForgeHookOutputToCopilot('Stop', {
      continue: false,
      stopReason: 'need another pass'
    })).toEqual({
      decision: 'block',
      reason: 'need another pass'
    })
  })

  it('uses a blocking fallback reason when Stop blocks without a stopReason', () => {
    expect(mapVibeForgeHookOutputToCopilot('Stop', {
      continue: false
    })).toEqual({
      decision: 'block',
      reason: 'blocked by Vibe Forge Stop hook'
    })
  })

  it('limits native hook loader support to events Copilot handles natively here', () => {
    expect(supportsHookEvent('PreToolUse')).toBe(true)
    expect(supportsHookEvent('PostToolUse')).toBe(true)
    expect(supportsHookEvent('Stop')).toBe(true)
    expect(supportsHookEvent('UserPromptSubmit')).toBe(false)
  })
})
