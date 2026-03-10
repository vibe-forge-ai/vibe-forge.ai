export interface TaskToolInput {
  description: string
  prompt: string
  subagent_type: string
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  run_in_background?: boolean
  max_turns?: number
}

export interface BashToolInput {
  command: string
  timeout?: number
  description?: string
  reason?: string
  thought?: string
  run_in_background?: boolean
  dangerouslyDisableSandbox?: boolean
  _simulatedSedEdit?: {
    filePath: string
    newContent: string
  }
}

export interface GlobToolInput {
  pattern: string
  path?: string
}

export interface GrepToolInput {
  pattern: string
  path?: string
  glob?: string
  output_mode?: 'content' | 'files_with_matches' | 'count'
  '-B'?: number
  '-A'?: number
  '-C'?: number
  context?: number
  '-n'?: boolean
  '-i'?: boolean
  type?: string
  head_limit?: number
  offset?: number
  multiline?: boolean
}

export interface ExitPlanModeToolInput {
  allowedPrompts?: Array<{
    tool: 'Bash'
    prompt: string
  }>
  pushToRemote?: boolean
  remoteSessionId?: string
  remoteSessionUrl?: string
  remoteSessionTitle?: string
}

export interface ReadToolInput {
  file_path: string
  offset?: number
  limit?: number
}

export interface EditToolInput {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

export interface WriteToolInput {
  file_path: string
  content: string
}

export interface NotebookEditToolInput {
  notebook_path: string
  cell_id?: string
  new_source: string
  cell_type?: 'code' | 'markdown'
  edit_mode?: 'replace' | 'insert' | 'delete'
}

export interface WebFetchToolInput {
  url: string
  prompt: string
}

export interface WebSearchToolInput {
  query: string
  allowed_domains?: string[]
  blocked_domains?: string[]
}

export interface AskUserQuestionToolInput {
  questions: Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description: string
    }>
    multiSelect: boolean
  }>
  answers?: Record<string, string>
  metadata?: {
    source?: string
  }
}

export interface SkillToolInput {
  skill: string
  args?: string
}

export interface EnterPlanModeToolInput {}

export interface TaskCreateToolInput {
  subject: string
  description: string
  activeForm?: string
  metadata?: Record<string, unknown>
}

export interface TaskGetToolInput {
  taskId: string
}

export interface TaskUpdateToolInput {
  taskId: string
  subject?: string
  description?: string
  activeForm?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'deleted'
  addBlocks?: string[]
  addBlockedBy?: string[]
  owner?: string
  metadata?: Record<string, unknown>
}

export interface TaskListToolInput {}

export interface LSToolInput {
  path?: string
  ignore?: string[]
}

export interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: string
  activeForm?: string
}

export interface TodoWriteToolInput {
  todos: TodoItem[]
  merge: boolean
  summary?: string
}

export interface ClaudeToolInputs {
  'adapter:claude-code:Task': TaskToolInput
  'adapter:claude-code:Bash': BashToolInput
  'adapter:claude-code:Glob': GlobToolInput
  'adapter:claude-code:Grep': GrepToolInput
  'adapter:claude-code:ExitPlanMode': ExitPlanModeToolInput
  'adapter:claude-code:Read': ReadToolInput
  'adapter:claude-code:Edit': EditToolInput
  'adapter:claude-code:Write': WriteToolInput
  'adapter:claude-code:NotebookEdit': NotebookEditToolInput
  'adapter:claude-code:WebFetch': WebFetchToolInput
  'adapter:claude-code:WebSearch': WebSearchToolInput
  'adapter:claude-code:AskUserQuestion': AskUserQuestionToolInput
  'adapter:claude-code:Skill': SkillToolInput
  'adapter:claude-code:EnterPlanMode': EnterPlanModeToolInput
  'adapter:claude-code:TaskCreate': TaskCreateToolInput
  'adapter:claude-code:TaskGet': TaskGetToolInput
  'adapter:claude-code:TaskUpdate': TaskUpdateToolInput
  'adapter:claude-code:TaskList': TaskListToolInput
  'adapter:claude-code:LS': LSToolInput
  'adapter:claude-code:TodoWrite': TodoWriteToolInput
}

export interface ClaudeToolOutputs {
  'adapter:claude-code:Read': {
    type: 'text' | (string & {})
    file: {
      filePath: string
      content: string
      numLines: number
      startLine: number
      totalLines: number
    }
  }
  'adapter:claude-code:LS': string
  'adapter:claude-code:Edit': {
    filePath: string
    newString: string
    oldString: string
    originalFile: string
  }
  'adapter:claude-code:Write': {
    filePath: string
    content: string
  }
  'adapter:claude-code:Bash': {
    stdout: string
    stderr: string
    interrupted: boolean
    isImage: boolean
  }
}

declare module '@vibe-forge/core' {
  interface ToolInputs extends ClaudeToolInputs {}
  interface ToolOutputs extends ClaudeToolOutputs {}
}
