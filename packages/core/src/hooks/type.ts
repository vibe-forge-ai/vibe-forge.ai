/**
 * https://docs.anthropic.com/en/docs/claude-code/hooks#hook-input
 */
export interface HookInputCore {
  cwd: string
  sessionId: string
  hookEventName: keyof HookInputs
  transcriptPath: string
}

/**
 * https://docs.anthropic.com/en/docs/claude-code/settings#tools-available-to-claude
 */
export interface ToolInputs {
  mcp__TmarAITools__notify: {
    title: string
    description: string
    sound?: boolean
  }
  'mcp__TmarAITools__run-tasks': {
    taskId: string
    agents: number[]
  }
  Read: {
    filePath: string
  }
  LS: {
    path: string
  }
  Edit: {
    filePath: string
    newString: string
    oldString: string
  }
  Write: {
    filePath: string
    content: string
  }
  Bash: {
    command: string
    description: string
  }
}

export interface ToolOutputs {
  mcp__TmarAITools__notify: {}
  'mcp__TmarAITools__run-tasks': {}
  Read: {
    type: 'text' | (string & {})
    file: {
      filePath: string
      content: string
      numLines: number
      startLine: number
      totalLines: number
    }
  }
  LS: string
  Edit: {
    filePath: string
    newString: string
    oldString: string
    originalFile: string
  }
  Write: {
    filePath: string
    content: string
  }
  Bash: {
    stdout: string
    stderr: string
    interrupted: boolean
    isImage: boolean
  }
}

// dprint-ignore
export type ToolInput = keyof ToolInputs extends infer Keys
  ? Keys extends infer Key extends keyof ToolInputs
    ? {
      toolName: Key
      toolInput: ToolInputs[Key]
    }
    : never
  : never

// dprint-ignore
export type ToolOutput = keyof ToolOutputs extends infer Keys
  ? Keys extends infer Key extends keyof ToolOutputs
    ? {
      toolName: Key
      toolInput: ToolInputs[Key]
      toolResponse?: ToolOutputs[Key]
    }
    : never
  : never

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
}

export type HookOutput = HookOutputs[keyof HookOutputs]
