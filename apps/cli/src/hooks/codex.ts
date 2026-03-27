import process from 'node:process'

import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'
import type { HookInput, HookOutput, HookOutputs } from '@vibe-forge/core/hooks'
import { executeHookInput, readHookInput } from '@vibe-forge/core/hooks'

type NativeCodexHookEventName = 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'UserPromptSubmit' | 'Stop'

interface NativeCodexHookInputBase {
  cwd: string
  hookEventName: NativeCodexHookEventName
  model?: string
  permissionMode?: AdapterQueryOptions['permissionMode']
  sessionId: string
}

interface NativeCodexPreToolUseInput extends NativeCodexHookInputBase {
  hookEventName: 'PreToolUse'
  toolInput?: unknown
  toolName?: string
  toolUseId?: string
}

interface NativeCodexPostToolUseInput extends NativeCodexHookInputBase {
  hookEventName: 'PostToolUse'
  toolInput?: unknown
  toolName?: string
  toolResponse?: unknown
  toolUseId?: string
}

interface NativeCodexSessionStartInput extends NativeCodexHookInputBase {
  hookEventName: 'SessionStart'
  source?: 'startup' | 'resume' | 'clear'
}

interface NativeCodexUserPromptSubmitInput extends NativeCodexHookInputBase {
  hookEventName: 'UserPromptSubmit'
  prompt: string
}

interface NativeCodexStopInput extends NativeCodexHookInputBase {
  hookEventName: 'Stop'
  lastAssistantMessage?: string
}

type NativeCodexHookInput =
  | NativeCodexPreToolUseInput
  | NativeCodexPostToolUseInput
  | NativeCodexSessionStartInput
  | NativeCodexUserPromptSubmitInput
  | NativeCodexStopInput

const runtime = (process.env.__VF_CODEX_HOOK_RUNTIME__ as AdapterQueryOptions['runtime'] | undefined)
const taskSessionId = process.env.__VF_CODEX_TASK_SESSION_ID__?.trim()

const blockReason = (value: unknown, fallback: string) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
)

const applyCommonOutput = (output: HookOutput) => {
  const result: Record<string, unknown> = {}
  if (typeof output.continue === 'boolean') result.continue = output.continue
  if (typeof output.stopReason === 'string') result.stopReason = output.stopReason
  if (typeof output.suppressOutput === 'boolean') result.suppressOutput = output.suppressOutput
  if (typeof output.systemMessage === 'string') result.systemMessage = output.systemMessage
  return result
}

export const mapCodexHookInputToVibeForge = (input: NativeCodexHookInput): HookInput => {
  const base = {
    cwd: input.cwd,
    sessionId: taskSessionId || input.sessionId,
    adapter: 'codex',
    runtime,
    hookSource: 'native' as const,
    canBlock: true
  }

  switch (input.hookEventName) {
    case 'PreToolUse':
      return {
        ...base,
        hookEventName: 'PreToolUse',
        toolCallId: input.toolUseId,
        toolName: input.toolName ?? 'Bash',
        toolInput: input.toolInput
      }
    case 'PostToolUse':
      return {
        ...base,
        hookEventName: 'PostToolUse',
        toolCallId: input.toolUseId,
        toolName: input.toolName ?? 'Bash',
        toolInput: input.toolInput,
        toolResponse: input.toolResponse
      }
    case 'SessionStart':
      return {
        ...base,
        hookEventName: 'SessionStart',
        source: input.source === 'resume' ? 'resume' : input.source === 'startup' ? 'startup' : undefined,
        model: input.model
      }
    case 'UserPromptSubmit':
      return {
        ...base,
        hookEventName: 'UserPromptSubmit',
        prompt: input.prompt
      }
    case 'Stop':
      return {
        ...base,
        hookEventName: 'Stop',
        lastAssistantMessage: input.lastAssistantMessage
      }
  }
}

export const mapVibeForgeHookOutputToCodex = (
  eventName: NativeCodexHookEventName,
  output: HookOutput
) => {
  const result: Record<string, unknown> = applyCommonOutput(output)

  switch (eventName) {
    case 'PreToolUse': {
      const hookSpecificOutput = (output as HookOutputs['PreToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PreToolUse') {
        result.hookSpecificOutput = hookSpecificOutput
      } else if (output.continue === false) {
        const reason = blockReason(output.stopReason, 'blocked by Vibe Forge PreToolUse hook')
        result.decision = 'block'
        result.reason = reason
        result.hookSpecificOutput = {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason
        }
      }
      return result
    }
    case 'PostToolUse': {
      const hookSpecificOutput = (output as HookOutputs['PostToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PostToolUse') {
        result.hookSpecificOutput = hookSpecificOutput
      }
      if (output.continue === false) {
        result.decision = 'block'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge PostToolUse hook')
      }
      return result
    }
    case 'SessionStart':
      return result
    case 'UserPromptSubmit':
      if (output.continue === false) {
        result.decision = 'block'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge UserPromptSubmit hook')
      }
      return result
    case 'Stop':
      if (output.continue === false) {
        result.decision = 'block'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge Stop hook')
      }
      return result
  }
}

const runCodexHookBridge = async () => {
  try {
    const input = await readHookInput() as NativeCodexHookInput
    const hookInput = mapCodexHookInputToVibeForge(input)
    const result = await executeHookInput(hookInput)
    console.log(JSON.stringify(mapVibeForgeHookOutputToCodex(input.hookEventName, result)))
  } catch (error) {
    console.log(JSON.stringify({
      continue: true,
      systemMessage: `vibe-forge codex hook bridge error: ${String(error)}`
    }))
  }
}

void runCodexHookBridge()
