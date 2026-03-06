import type { ToolInput, ToolOutput } from '../tools'

/**
 * https://docs.anthropic.com/en/docs/claude-code/hooks#hook-input
 */
export interface HookInputCore {
  cwd: string
  sessionId: string
  hookEventName: keyof HookInputs
}

export interface HookInputs {
  /**
   * https://docs.anthropic.com/en/docs/claude-code/hooks#pretooluse-input
   */
  PreToolUse: HookInputCore & ToolInput
  /**
   * https://docs.anthropic.com/en/docs/claude-code/hooks#posttooluse-input
   */
  PostToolUse: HookInputCore & ToolOutput
  Notification: HookInputCore
  UserPromptSubmit: HookInputCore & { prompt: string }
  Stop: HookInputCore
  SubagentStop: HookInputCore
  PreCompact: HookInputCore
  SessionStart: HookInputCore
  SessionEnd: HookInputCore & {
    reason: string
  }

  StartTasks: HookInputCore & {
    tasks: Array<{
      description: string
      type: 'default' | 'spec' | 'entity'
      name?: string
      adapter?: string
      background?: boolean
    }>
  }
  GenerateSystemPrompt: HookInputCore & {
    type?: 'spec' | 'entity'
    name?: string
    data?: unknown
  }
  TaskStart: HookInputCore & {
    adapter?: string
    options: unknown
    adapterOptions: unknown
  }
  TaskStop: HookInputCore & {
    exitCode?: number
    stderr?: string
    adapter?: string

    options: unknown
    adapterOptions: unknown
  }
}

export type HookInput = HookInputs[keyof HookInputs]

/**
 * https://docs.anthropic.com/en/docs/claude-code/hooks#common-json-fields
 */
export interface HookOutputCore {
  /**
   * Whether Claude should continue after hook execution
   * @default true
   */
  continue?: boolean
  /**
   * Message shown when continue is false
   */
  stopReason?: string
  /**
   * Hide stdout from transcript mode
   * @default false
   */
  suppressOutput?: boolean
  /**
   * Optional warning message shown to the user
   */
  systemMessage?: string
}

export interface HookOutputs {
  /**
   * https://docs.anthropic.com/en/docs/claude-code/hooks#pretooluse-decision-control
   */
  PreToolUse: HookOutputCore & {
    hookSpecificOutput?: {
      hookEventName: 'PreToolUse'
      permissionDecision: 'allow' | 'deny' | 'ask'
      permissionDecisionReason: string
    }
  }
  /**
   * https://docs.anthropic.com/en/docs/claude-code/hooks#posttooluse-decision-control
   */
  PostToolUse: HookOutputCore & {
    hookSpecificOutput?: {
      hookEventName: 'PostToolUse'
      additionalContext: string
    }
  }
  Notification: HookOutputCore
  UserPromptSubmit: HookOutputCore
  Stop: HookOutputCore
  SessionStart: HookOutputCore
  SessionEnd: HookOutputCore
  SubagentStop: HookOutputCore
  PreCompact: HookOutputCore

  StartTasks: HookOutputCore
  GenerateSystemPrompt: HookOutputCore
  TaskStart: HookOutputCore
  TaskStop: HookOutputCore
}

export type HookOutput = HookOutputs[keyof HookOutputs]
