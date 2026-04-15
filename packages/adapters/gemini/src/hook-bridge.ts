/* eslint-disable max-lines */

import process from 'node:process'

import type { HookInput, HookInputs, HookOutput, HookOutputs } from '@vibe-forge/hooks'
import { executeHookInput, readHookInput } from '@vibe-forge/hooks'
import type { AdapterQueryOptions } from '@vibe-forge/types'

type NativeGeminiHookEventName =
  | 'AfterAgent'
  | 'AfterTool'
  | 'BeforeAgent'
  | 'BeforeTool'
  | 'PreCompress'
  | 'SessionStart'

interface NativeGeminiHookInputBase {
  cwd: string
  hookEventName: NativeGeminiHookEventName
  model?: string
  sessionId: string
  transcriptPath?: string | null
}

interface NativeGeminiBeforeToolInput extends NativeGeminiHookInputBase {
  hookEventName: 'BeforeTool'
  toolInput?: unknown
  toolName?: string
}

interface NativeGeminiAfterToolInput extends NativeGeminiHookInputBase {
  hookEventName: 'AfterTool'
  toolInput?: unknown
  toolName?: string
  toolResponse?: unknown
}

interface NativeGeminiBeforeAgentInput extends NativeGeminiHookInputBase {
  hookEventName: 'BeforeAgent'
  prompt?: string
}

interface NativeGeminiAfterAgentInput extends NativeGeminiHookInputBase {
  hookEventName: 'AfterAgent'
  promptResponse?: string
  stopHookActive?: boolean
}

interface NativeGeminiSessionStartInput extends NativeGeminiHookInputBase {
  hookEventName: 'SessionStart'
  source?: 'clear' | 'resume' | 'startup'
}

interface NativeGeminiPreCompressInput extends NativeGeminiHookInputBase {
  hookEventName: 'PreCompress'
}

type NativeGeminiHookInput =
  | NativeGeminiAfterAgentInput
  | NativeGeminiAfterToolInput
  | NativeGeminiBeforeAgentInput
  | NativeGeminiBeforeToolInput
  | NativeGeminiPreCompressInput
  | NativeGeminiSessionStartInput

const runtime = process.env.__VF_GEMINI_HOOK_RUNTIME__ as AdapterQueryOptions['runtime'] | undefined
const taskSessionId = process.env.__VF_GEMINI_TASK_SESSION_ID__?.trim()
const taskModel = process.env.__VF_GEMINI_HOOK_MODEL__?.trim()

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

const toAdditionalContext = (value: unknown) => {
  if (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { additionalContext?: unknown }).additionalContext === 'string'
  ) {
    return {
      additionalContext: (value as { additionalContext: string }).additionalContext
    }
  }

  return undefined
}

const isBlockableEvent = (eventName: NativeGeminiHookEventName) => (
  eventName === 'SessionStart' ||
  eventName === 'BeforeAgent' ||
  eventName === 'BeforeTool' ||
  eventName === 'AfterTool' ||
  eventName === 'PreCompress'
)

export const isGeminiNativeHookEnv = () => (
  process.env.__VF_VIBE_FORGE_GEMINI_HOOKS_ACTIVE__ === '1'
)

export const supportsHookEvent = (_eventName: keyof HookInputs) => false

export const mapGeminiHookInputToVibeForge = (input: NativeGeminiHookInput): HookInput => {
  const base = {
    cwd: input.cwd,
    sessionId: taskSessionId || input.sessionId,
    transcriptPath: input.transcriptPath,
    adapter: 'gemini',
    runtime,
    hookSource: 'native' as const,
    canBlock: isBlockableEvent(input.hookEventName)
  }

  switch (input.hookEventName) {
    case 'BeforeTool':
      return {
        ...base,
        hookEventName: 'PreToolUse',
        toolName: input.toolName ?? 'unknown',
        toolInput: input.toolInput
      }
    case 'AfterTool':
      return {
        ...base,
        hookEventName: 'PostToolUse',
        toolName: input.toolName ?? 'unknown',
        toolInput: input.toolInput,
        toolResponse: input.toolResponse
      }
    case 'BeforeAgent':
      return {
        ...base,
        hookEventName: 'UserPromptSubmit',
        prompt: input.prompt ?? ''
      }
    case 'AfterAgent':
      return {
        ...base,
        hookEventName: 'Stop',
        lastAssistantMessage: input.promptResponse,
        stopHookActive: input.stopHookActive
      }
    case 'SessionStart':
      return {
        ...base,
        hookEventName: 'SessionStart',
        source: input.source === 'resume' ? 'resume' : input.source === 'startup' ? 'startup' : undefined,
        model: input.model ?? taskModel
      }
    case 'PreCompress':
      return {
        ...base,
        hookEventName: 'PreCompact'
      }
  }
}

export const mapVibeForgeHookOutputToGemini = (
  eventName: NativeGeminiHookEventName,
  output: HookOutput
) => {
  switch (eventName) {
    case 'BeforeTool': {
      const result = applyOutputFields(output, { systemMessage: true })
      const hookSpecificOutput = (output as HookOutputs['PreToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PreToolUse') {
        result.decision = hookSpecificOutput.permissionDecision
        result.reason = hookSpecificOutput.permissionDecisionReason
      } else if (output.continue === false) {
        result.decision = 'deny'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge BeforeTool hook')
      }
      return result
    }
    case 'AfterTool': {
      const result = applyOutputFields(output, {
        continue: true,
        stopReason: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['PostToolUse']).hookSpecificOutput
      const additionalContext = toAdditionalContext(hookSpecificOutput)
      if (additionalContext != null) result.hookSpecificOutput = additionalContext
      return result
    }
    case 'BeforeAgent': {
      const result = applyOutputFields(output, {
        suppressOutput: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['UserPromptSubmit']).hookSpecificOutput
      const additionalContext = toAdditionalContext(hookSpecificOutput)
      if (additionalContext != null) result.hookSpecificOutput = additionalContext
      if (output.continue === false) {
        result.decision = 'deny'
        result.reason = blockReason(output.stopReason, 'blocked by Vibe Forge BeforeAgent hook')
      }
      return result
    }
    case 'AfterAgent': {
      const result = applyOutputFields(output, {
        suppressOutput: true,
        systemMessage: true
      })
      if (output.continue === false && result.systemMessage == null) {
        result.systemMessage = blockReason(output.stopReason, 'Vibe Forge AfterAgent hook requested a stop')
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
      const additionalContext = toAdditionalContext(hookSpecificOutput)
      if (additionalContext != null) result.hookSpecificOutput = additionalContext
      return result
    }
    case 'PreCompress':
      return applyOutputFields(output, {
        continue: true,
        stopReason: true,
        suppressOutput: true,
        systemMessage: true
      })
  }
}

export const runGeminiHookBridge = async () => {
  try {
    const input = await readHookInput() as NativeGeminiHookInput
    const hookInput = mapGeminiHookInputToVibeForge(input)
    const result = await executeHookInput(hookInput)
    process.stdout.write(`${JSON.stringify(mapVibeForgeHookOutputToGemini(input.hookEventName, result))}\n`)
  } catch (error) {
    process.stdout.write(`${
      JSON.stringify({
        continue: true,
        systemMessage: `vibe-forge gemini hook bridge error: ${String(error)}`
      })
    }\n`)
  }
}

export const isNativeHookEnv = isGeminiNativeHookEnv
export const runHookBridge = runGeminiHookBridge
