/* eslint-disable max-lines -- Copilot hook bridge keeps input and output adapters together. */
import process from 'node:process'

import type { HookInput, HookInputs, HookOutput, HookOutputs } from '@vibe-forge/hooks'
import { executeHookInput, readHookInput } from '@vibe-forge/hooks'
import type { AdapterQueryOptions } from '@vibe-forge/types'

type NativeCopilotHookEventName =
  | 'PostToolUse'
  | 'PreToolUse'
  | 'Stop'
  | 'agentStop'
  | 'postToolUse'
  | 'preToolUse'

interface NativeCopilotHookInputBase {
  cwd: string
  hookEventName?: NativeCopilotHookEventName
  hook_event_name?: 'PostToolUse' | 'PreToolUse' | 'Stop'
  sessionId?: string
  session_id?: string
  timestamp?: number | string
  toolArgs?: unknown
  toolName?: string
  toolResult?: unknown
  tool_input?: unknown
  tool_name?: string
  tool_result?: unknown
  transcriptPath?: string | null
  transcript_path?: string | null
}

interface NativeCopilotPreToolUseInput extends NativeCopilotHookInputBase {
  hookEventName?: 'preToolUse'
  hook_event_name?: 'PreToolUse'
}

interface NativeCopilotPostToolUseInput extends NativeCopilotHookInputBase {
  hookEventName?: 'postToolUse'
  hook_event_name?: 'PostToolUse'
}

interface NativeCopilotStopInput extends NativeCopilotHookInputBase {
  hookEventName?: 'agentStop'
  hook_event_name?: 'Stop'
  stopReason?: string
  stop_reason?: string
}

export type NativeCopilotHookInput =
  | NativeCopilotPostToolUseInput
  | NativeCopilotPreToolUseInput
  | NativeCopilotStopInput

const runtime = process.env.__VF_COPILOT_HOOK_RUNTIME__ as AdapterQueryOptions['runtime'] | undefined
const taskSessionId = process.env.__VF_COPILOT_TASK_SESSION_ID__?.trim()

const blockReason = (value: unknown, fallback: string) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
)

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed === '') return value
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

const normalizeRawEventName = (raw: unknown): 'PostToolUse' | 'PreToolUse' | 'Stop' | undefined => {
  if (raw === 'PreToolUse' || raw === 'preToolUse') return 'PreToolUse'
  if (raw === 'PostToolUse' || raw === 'postToolUse') return 'PostToolUse'
  if (raw === 'Stop' || raw === 'agentStop') return 'Stop'
  return undefined
}

const normalizeEventName = (input: NativeCopilotHookInput): 'PostToolUse' | 'PreToolUse' | 'Stop' => {
  const payloadEventName = normalizeRawEventName(input.hook_event_name ?? input.hookEventName)
  if (payloadEventName != null) return payloadEventName
  const envEventName = normalizeRawEventName(process.env.__VF_VIBE_FORGE_HOOK_EVENT_NAME__)
  if (envEventName != null) return envEventName
  if (input.tool_result != null || input.toolResult != null) return 'PostToolUse'
  if (input.tool_name != null || input.toolName != null) return 'PreToolUse'
  return 'Stop'
}

const applyOutputFields = (
  output: HookOutput,
  supported: {
    additionalContext?: boolean
    systemMessage?: boolean
  }
) => {
  const result: Record<string, unknown> = {}
  if (supported.systemMessage && typeof output.systemMessage === 'string') result.systemMessage = output.systemMessage
  if (supported.additionalContext) {
    const hookSpecificOutput = (output as HookOutputs['PostToolUse'] | HookOutputs['PreToolUse']).hookSpecificOutput
    if (
      hookSpecificOutput != null &&
      typeof hookSpecificOutput === 'object' &&
      'additionalContext' in hookSpecificOutput &&
      typeof hookSpecificOutput.additionalContext === 'string'
    ) {
      result.additionalContext = hookSpecificOutput.additionalContext
    }
  }
  return result
}

export const isCopilotNativeHookEnv = () => (
  process.env.__VF_VIBE_FORGE_COPILOT_HOOKS_ACTIVE__ === '1'
)

export const supportsHookEvent = (eventName: keyof HookInputs) => (
  eventName === 'PreToolUse' ||
  eventName === 'PostToolUse' ||
  eventName === 'Stop'
)

export const mapCopilotHookInputToVibeForge = (input: NativeCopilotHookInput): HookInput => {
  const eventName = normalizeEventName(input)
  const base = {
    cwd: input.cwd,
    sessionId: taskSessionId || input.session_id || input.sessionId || 'copilot-session',
    transcriptPath: input.transcript_path ?? input.transcriptPath,
    adapter: 'copilot',
    runtime,
    hookSource: 'native' as const,
    canBlock: eventName !== 'PostToolUse'
  }

  if (eventName === 'PreToolUse') {
    return {
      ...base,
      hookEventName: 'PreToolUse',
      toolName: input.tool_name ?? input.toolName ?? 'unknown',
      toolInput: parseMaybeJson(input.tool_input ?? input.toolArgs)
    }
  }

  if (eventName === 'PostToolUse') {
    return {
      ...base,
      hookEventName: 'PostToolUse',
      toolName: input.tool_name ?? input.toolName ?? 'unknown',
      toolInput: parseMaybeJson(input.tool_input ?? input.toolArgs),
      toolResponse: input.tool_result ?? input.toolResult
    }
  }

  return {
    ...base,
    hookEventName: 'Stop',
    lastAssistantMessage: undefined
  }
}

export const mapVibeForgeHookOutputToCopilot = (
  eventName: 'PostToolUse' | 'PreToolUse' | 'Stop',
  output: HookOutput
) => {
  switch (eventName) {
    case 'PreToolUse': {
      const result = applyOutputFields(output, {
        additionalContext: true,
        systemMessage: true
      })
      const hookSpecificOutput = (output as HookOutputs['PreToolUse']).hookSpecificOutput
      if (hookSpecificOutput?.hookEventName === 'PreToolUse') {
        result.permissionDecision = hookSpecificOutput.permissionDecision
        result.permissionDecisionReason = hookSpecificOutput.permissionDecisionReason
      } else if (output.continue === false) {
        result.permissionDecision = 'deny'
        result.permissionDecisionReason = blockReason(output.stopReason, 'blocked by Vibe Forge PreToolUse hook')
      }
      return result
    }
    case 'PostToolUse':
      return applyOutputFields(output, {
        additionalContext: true,
        systemMessage: true
      })
    case 'Stop': {
      if (output.continue === false) {
        return {
          decision: 'block',
          reason: blockReason(output.stopReason, 'blocked by Vibe Forge Stop hook')
        }
      }
      return {}
    }
  }
}

export const runCopilotHookBridge = async () => {
  try {
    const input = await readHookInput() as unknown as NativeCopilotHookInput
    const eventName = normalizeEventName(input)
    const hookInput = mapCopilotHookInputToVibeForge(input)
    const result = await executeHookInput(hookInput)
    process.stdout.write(`${JSON.stringify(mapVibeForgeHookOutputToCopilot(eventName, result))}\n`)
  } catch (error) {
    process.stdout.write(`${
      JSON.stringify({
        systemMessage: `vibe-forge copilot hook bridge error: ${String(error)}`
      })
    }\n`)
  }
}

export const isNativeHookEnv = isCopilotNativeHookEnv
export const runHookBridge = runCopilotHookBridge
