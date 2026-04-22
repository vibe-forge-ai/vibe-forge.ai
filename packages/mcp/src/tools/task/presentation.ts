import process from 'node:process'

import type { SessionPermissionMode } from '@vibe-forge/types'

import type { TaskInfo } from './manager'

export const SESSION_PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions'] as const
export const TASK_LOG_ORDERS = ['asc', 'desc'] as const
export const DEFAULT_TASK_LOG_LIMIT = 10
export type TaskLogsOrder = typeof TASK_LOG_ORDERS[number]

export const START_TASKS_DESCRIPTION =
  'Start multiple tasks in background or foreground. Use type "workspace" plus name to run in a configured workspace. If a task stalls, fails, or asks for permission/input, call GetTaskInfo. GetTaskInfo returns the 10 most recent logs by default in descending order, so newer log lines appear earlier in the logs array. If you need to add another instruction to a task that is still running, use SendTaskMessage instead of starting a replacement task. If GetTaskInfo returns pendingInput or pendingInteraction, resolve it with SubmitTaskInput. If logs show permission_required, you can answer the recovery prompt with SubmitTaskInput instead of restarting manually.'

export const GET_TASK_INFO_DESCRIPTION =
  'Get the detailed status, logs, pendingInput, pendingInteraction, lastError, and guidance for a task. By default this returns the 10 most recent logs in descending order, so newer log lines appear earlier in the logs array. Use logLimit to inspect a different number of recent logs, and set logOrder to "asc" when you want the selected log window in oldest-to-newest order. If the task is still running and you need to steer it with another instruction, call SendTaskMessage. If pendingInput is present, answer it with SubmitTaskInput.'

export const SEND_TASK_MESSAGE_DESCRIPTION =
  'Send a follow-up user message to a managed task that is still running, so you can continue the same task without starting a replacement task. Use this only when the task status is running. Do not use it to answer pendingInput or pendingInteraction; use SubmitTaskInput for that. If the task already completed or failed, start a new task instead.'

export const SUBMIT_TASK_INPUT_DESCRIPTION =
  'Submit input for a task that is blocked waiting for permission or user input. First call GetTaskInfo or ListTasks, then use taskId plus one of pendingInput.payload.options[].value when available. Do not use this for ordinary follow-up instructions to a running task; use SendTaskMessage instead. Common permission answers are allow_once, allow_session, allow_project, deny_once, deny_session, or deny_project.'

export const RESPOND_TASK_INTERACTION_DESCRIPTION =
  'Deprecated alias of SubmitTaskInput. Use SubmitTaskInput for both permission prompts and generic task input.'

export const STOP_TASK_DESCRIPTION =
  'Stop a running or blocked task. Use this when the task is no longer needed or cannot recover cleanly.'

export const LIST_TASKS_DESCRIPTION =
  'List all managed tasks with status, logs, pendingInput, pendingInteraction, lastError, and guidance. Each task returns the 10 most recent logs by default in descending order, so newer log lines appear earlier in the logs array. Use logLimit and logOrder to adjust the recent log window for every listed task. If a listed task is still running and needs another instruction, call SendTaskMessage. If it is waiting for input, call GetTaskInfo for details or SubmitTaskInput to answer it.'

export const TASK_PERMISSION_MODE_DESCRIPTION =
  'Permission mode for the task. If omitted, inherits the parent session. Raise it only when the task is blocked by permission errors.'

export const TASK_BACKGROUND_DESCRIPTION =
  'Whether to run in background (default: true). If false, waits until the task completes, fails, or becomes blocked waiting for input, then returns the current logs.'

export const TASK_LOG_LIMIT_DESCRIPTION =
  `How many recent log entries to include. Defaults to ${DEFAULT_TASK_LOG_LIMIT}.`

export const TASK_LOG_ORDER_DESCRIPTION =
  'Order of the selected log window. Defaults to "desc", which returns newer log lines first. Use "asc" for oldest-to-newest order.'

export const resolveInheritedPermissionMode = (): SessionPermissionMode | undefined => {
  const value = process.env.__VF_PROJECT_AI_PERMISSION_MODE__?.trim()
  if (value == null || value === '') return undefined
  return (SESSION_PERMISSION_MODES as readonly string[]).includes(value)
    ? value as SessionPermissionMode
    : undefined
}

const buildTaskGuidance = (task: {
  status?: string
  pendingInteraction?: { payload?: { options?: Array<{ label: string; value?: string }> } }
  lastError?: { code?: string }
}) => {
  const hints: string[] = []

  if (task.pendingInteraction != null) {
    const optionValues = task.pendingInteraction.payload?.options
      ?.map(option => option.value ?? option.label)
      .filter((value): value is string => value.trim() !== '')
    hints.push(
      optionValues != null && optionValues.length > 0
        ? `Task is waiting for input. Call SubmitTaskInput with one of: ${optionValues.join(', ')}.`
        : 'Task is waiting for input. Call SubmitTaskInput with the desired answer.'
    )
  }

  if (task.lastError?.code === 'permission_required') {
    hints.push(
      'Task hit a permission error. Retry StartTasks with a more suitable permissionMode, or update project permissions before retrying.'
    )
  }

  if (task.status === 'failed' && hints.length === 0) {
    hints.push('Task failed. Inspect logs and lastError, then restart the task if needed.')
  }

  return hints
}

export const serializeTaskInfo = (params: {
  taskId: string
  description?: string
  status?: TaskInfo['status']
  info?: TaskInfo
  logLimit?: number
  logOrder?: TaskLogsOrder
}) => {
  const info = params.info
  const safeInfo = (() => {
    if (info == null) {
      return undefined
    }
    const { session, onStop, serverSync, createdAt, logs, ...rest } = info
    return rest
  })()
  const selectedLogs = (() => {
    const logs = info?.logs ?? []
    const limit = params.logLimit
    const windowedLogs = limit == null
      ? logs
      : logs.slice(Math.max(0, logs.length - limit))
    return params.logOrder === 'desc'
      ? [...windowedLogs].reverse()
      : windowedLogs
  })()

  return {
    taskId: params.taskId,
    description: params.description ?? info?.description,
    status: info?.status ?? params.status,
    logs: selectedLogs,
    pendingInput: safeInfo?.pendingInteraction,
    ...safeInfo,
    guidance: buildTaskGuidance(safeInfo ?? {})
  }
}
