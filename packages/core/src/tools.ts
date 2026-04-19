export interface StopTaskToolInput {
  task_id?: string
}

export interface StartTasksToolInput {
  tasks: Array<{
    description?: string
    type?: 'default' | 'spec' | 'entity' | 'workspace'
    name?: string
    adapter?: string
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    background?: boolean
  }>
}

export interface GetTaskInfoToolInput {
  taskId: string
}

export interface ListTasksToolInput {}

export interface ToolInputs {
  StartTasks: StartTasksToolInput
  GetTaskInfo: GetTaskInfoToolInput
  ListTasks: ListTasksToolInput
  StopTask: StopTaskToolInput
}

export interface ToolOutputs {}

export type ToolName = keyof ToolInputs

export type ToolInput = keyof ToolInputs extends infer Keys ? Keys extends infer Key extends keyof ToolInputs ? {
      toolName: Key
      toolInput: ToolInputs[Key]
    }
  : never
  : never

export type ToolOutput = keyof ToolOutputs extends infer Keys ? Keys extends infer Key extends keyof ToolOutputs ? {
      toolName: Key
      toolInput: ToolInputs[Key]
      toolResponse?: ToolOutputs[Key]
    }
  : never
  : never
