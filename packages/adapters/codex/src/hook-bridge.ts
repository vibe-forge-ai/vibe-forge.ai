import process from 'node:process'

import type { HookInput, HookOutput, HookOutputs } from '@vibe-forge/hooks'
import { executeHookInput, readHookInput } from '@vibe-forge/hooks'
import type { AdapterQueryOptions } from '@vibe-forge/types'

type NativeCodexHookEventName = 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'UserPromptSubmit' | 'Stop'

interface NativeCodexHookInputBase {
  cwd: string
  hookEventName: NativeCodexHookEventName
  model?: string
  sessionId: string
  transcriptPath?: string | null
}

interface NativeCodexPreToolUseInput extends NativeCodexHookInputBase {
  hookEventName: 'PreToolUse'
  toolInput?: unknown
  toolName?: string
  toolUseId?: string
  turnId?: string
}

interface NativeCodexPostToolUseInput extends NativeCodexHookInputBase {
  hookEventName: 'PostToolUse'
  toolInput?: unknown
  toolName?: string
  toolResponse?: unknown
  toolUseId?: string
  turnId?: string
}

interface NativeCodexSessionStartInput extends NativeCodexHookInputBase {
  hookEventName: 'SessionStart'
  source?: 'startup' | 'resume' | 'clear'
}

interface NativeCodexUserPromptSubmitInput extends NativeCodexHookInputBase {
  hookEventName: 'UserPromptSubmit'
  prompt: string
  turnId?: string
}

interface NativeCodexStopInput extends NativeCodexHookInputBase {
  hookEventName: 'Stop'
  lastAssistantMessage?: string | null
  stopHookActive?: boolean
  turnId?: string
}

export type NativeCodexHookInput =
  | NativeCodexPreToolUseInput
  | NativeCodexPostToolUseInput
  | NativeCodexSessionStartInput
  | NativeCodexUserPromptSubmitInput
  | NativeCodexStopInput

const runtime = process.env.__VF_CODEX_HOOK_RUNTIME__ as AdapterQueryOptions['runtime'] | undefined
const taskSessionId = process.env.__VF_CODEX_TASK_SESSION_ID__?.trim()

const blockReason = (value: unknown, fallback: string) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
)

const applyOutputFields = (
  output: HookOutput,
  supported: {
    continue?: boolean
    stopReason?: boolean
    suppressOutput?: boolean
    systemMessage?: boolean
  }
) => {
  const result: Record<string, unknown> = {}
  if (supported.continue && typeof output.continue === 'boolean') result.continue = output.continue
  if (supported.stopReason && typeof output.stopReason === 'string') result.stopReason = output.stopReason
  if (supported.suppressOutput && typeof output.suppressOutput === 'boolean') {
    result.suppressOutput = output.suppressOutput
  }
  if (supported.systemMessage && typeof output.systemMessage === 'string') result.systemMessage = output.systemMessage
  return result
}

export const isCodexNativeHookEnv = () => (
  process.env.__VF_VIBE_FORGE_CODEX_HOOKS_ACTIVE__ === '1'
)

export const supportsHookEvent = (eventName: keyof HookOutputs) => (
  eventName === 'PreToolUse' ||
  eventName === 'PostToolUse' ||
  eventName === 'SessionStart' ||
  eventName === 'UserPromptSubmit' ||
  eventName === 'Stop'
)

export const mapCodexHookInputToVibeForge = (input: NativeCodexHookInput): HookInput => {
  const base = {
    cwd: input.cwd,
    sessionId: taskSessionId || input.sessionId,
    transcriptPath: input.transcriptPath,
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
        turnId: input.turnId,
        toolCallId: input.toolUseId,
        toolName: input.toolName ?? 'Bash',
        toolInput: input.toolInput
      }
    case 'PostToolUse':
      return {
        ...base,
        hookEventName: 'PostToolUse',
        turnId: input.turnId,
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
        turnId: input.turnId,
        prompt: input.prompt
      }
    case 'Stop':
      return {
        ...base,
        hookEventName: 'Stop',
        turnId: input.turnId,
        stopHookActive: input.stopHookActive,
        lastAssistantMessage: input.lastAssistantMessage ?? undefined
      }
  }
}

export const mapVibeForgeHookOutputToCodex = (
  eventName: NativeCodexHookEventName,
  output: HookOutput
) => {
  switch (eventName) {
    case 'PreToolUse': {
      const result = applyOutputFields(output, { systemMessage: true })
      const hookSpecificOutput = (output as HookOutputs['PreToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PreToolUse') {
        result.hookSpecificOutput = hookSpecificOutput
        if (hookSpecificOutput.permissionDecision === 'deny') {
          result.decision = 'block'
          result.reason = hookSpecificOutput.permissionDecisionReason
        }
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
      const result = applyOutputFields(output, {
        continue: true,
        stopReason: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['PostToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PostToolUse') {
        result.hookSpecificOutput = hookSpecificOutput
      }
      return result
    }
    case 'SessionStart': {
      const result = applyOutputFields(output, {
        continue: true,
        stopReason: true,
        suppressOutput: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['SessionStart']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'SessionStart') {
        result.hookSpecificOutput = hookSpecificOutput
      }
      return result
    }
    case 'UserPromptSubmit': {
      const result = applyOutputFields(output, {
        suppressOutput: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['UserPromptSubmit']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'UserPromptSubmit') {
        result.hookSpecificOutput = hookSpecificOutput
      }
      if (output.continue === false) {
        result.decision = 'block'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge UserPromptSubmit hook')
      }
      return result
    }
    case 'Stop': {
      const result = applyOutputFields(output, {
        continue: true,
        stopReason: true,
        suppressOutput: true,
        systemMessage: true
      })
      return result
    }
  }
}

export const runCodexHookBridge = async () => {
  try {
    const input = await readHookInput() as NativeCodexHookInput
    const hookInput = mapCodexHookInputToVibeForge(input)
    const result = await executeHookInput(hookInput)
    process.stdout.write(`${JSON.stringify(mapVibeForgeHookOutputToCodex(input.hookEventName, result))}\n`)
  } catch (error) {
    process.stdout.write(`${
      JSON.stringify({
        continue: true,
        systemMessage: `vibe-forge codex hook bridge error: ${String(error)}`
      })
    }\n`)
  }
}

export const isNativeHookEnv = isCodexNativeHookEnv
export const runHookBridge = runCodexHookBridge
