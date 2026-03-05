export interface TaskToolInput {
  description: string
  prompt: string
  subagent_type: string
  model?: 'sonnet' | 'opus' | 'haiku'
  resume?: string
  run_in_background?: boolean
  max_turns?: number
}

export interface TaskOutputToolInput {
  task_id: string
  block: boolean
  timeout: number
}

export interface BashToolInput {
  command: string
  timeout?: number
  description?: string
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

export interface TaskStopToolInput {
  task_id?: string
  shell_id?: string
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

export interface ToolInputs {
  Task: TaskToolInput
  TaskOutput: TaskOutputToolInput
  Bash: BashToolInput
  Glob: GlobToolInput
  Grep: GrepToolInput
  ExitPlanMode: ExitPlanModeToolInput
  Read: ReadToolInput
  Edit: EditToolInput
  Write: WriteToolInput
  NotebookEdit: NotebookEditToolInput
  WebFetch: WebFetchToolInput
  WebSearch: WebSearchToolInput
  TaskStop: TaskStopToolInput
  AskUserQuestion: AskUserQuestionToolInput
  Skill: SkillToolInput
  EnterPlanMode: EnterPlanModeToolInput
  TaskCreate: TaskCreateToolInput
  TaskGet: TaskGetToolInput
  TaskUpdate: TaskUpdateToolInput
  TaskList: TaskListToolInput
}

export type ToolName = keyof ToolInputs

export interface ToolInput<TName extends ToolName = ToolName> {
  toolName: TName
  toolInput: ToolInputs[TName]
}
