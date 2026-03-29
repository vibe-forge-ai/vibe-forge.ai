import process from 'node:process'

import type { AdapterQueryOptions } from '@vibe-forge/types'
import type { HookInput, HookInputs } from '@vibe-forge/hooks'
import { executeHookInput, readHookInput } from '@vibe-forge/hooks'

const runtime = process.env.__VF_CLAUDE_HOOK_RUNTIME__ as AdapterQueryOptions['runtime'] | undefined
const taskSessionId = process.env.__VF_CLAUDE_TASK_SESSION_ID__?.trim()

const SUPPORTED_EVENTS = new Set<keyof HookInputs>([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact'
])

const BLOCKABLE_EVENTS = new Set<keyof HookInputs>([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PreCompact'
])

export const isClaudeNativeHookEnv = () => (
  process.env.__VF_VIBE_FORGE_CLAUDE_HOOKS_ACTIVE__ === '1'
)

const canBlock = (eventName: keyof HookInputs) => BLOCKABLE_EVENTS.has(eventName)

export const mapClaudeHookInputToVibeForge = (input: HookInput) => {
  if (!SUPPORTED_EVENTS.has(input.hookEventName)) return undefined

  return {
    ...input,
    sessionId: taskSessionId || input.sessionId,
    adapter: 'claude-code',
    runtime: input.runtime ?? runtime,
    hookSource: 'native' as const,
    canBlock: input.canBlock ?? canBlock(input.hookEventName)
  } satisfies HookInput
}

export const runClaudeHookBridge = async () => {
  try {
    const input = await readHookInput() as HookInput
    const hookInput = mapClaudeHookInputToVibeForge(input)
    if (hookInput == null) {
      process.stdout.write(`${JSON.stringify({ continue: true })}\n`)
      return
    }

    const result = await executeHookInput(hookInput)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      continue: true,
      systemMessage: `vibe-forge claude hook bridge error: ${String(error)}`
    })}\n`)
  }
}

export const isNativeHookEnv = isClaudeNativeHookEnv
export const runHookBridge = runClaudeHookBridge
