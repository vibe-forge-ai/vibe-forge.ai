import process from 'node:process'

import type { SessionPermissionMode } from '@vibe-forge/types'

import type { TaskInfo } from './manager'

export const SESSION_PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions'] as const

export const START_TASKS_DESCRIPTION =
  'Start multiple tasks in background or foreground. Use type "workspace" plus name to run in a configured workspace. If a task stalls, fails, or asks for permission/input, call GetTaskInfo. If GetTaskInfo returns pendingInput or pendingInteraction, resolve it with SubmitTaskInput. If logs show permission_required, you can answer the recovery prompt with SubmitTaskInput instead of restarting manually.'

export const GET_TASK_INFO_DESCRIPTION =
  'Get the detailed status, logs, pendingInput, pendingInteraction, lastError, and guidance for a task. Use this when a task seems stuck, is waiting for permission/input, or has failed. If pendingInput is present, answer it with SubmitTaskInput.'

export const SUBMIT_TASK_INPUT_DESCRIPTION =
  'Submit input for a task that is blocked waiting for permission or user input. First call GetTaskInfo or ListTasks, then use taskId plus one of pendingInput.payload.options[].value when available. Common permission answers are allow_once, allow_session, allow_project, deny_once, deny_session, or deny_project.'

export const RESPOND_TASK_INTERACTION_DESCRIPTION =
  'Deprecated alias of SubmitTaskInput. Use SubmitTaskInput for both permission prompts and generic task input.'

export const STOP_TASK_DESCRIPTION =
  'Stop a running or blocked task. Use this when the task is no longer needed or cannot recover cleanly.'

export const LIST_TASKS_DESCRIPTION =
  'List all managed tasks with status, pendingInput, pendingInteraction, lastError, and guidance. Use this first to find which tasks are blocked; then call GetTaskInfo for one task or SubmitTaskInput if it is waiting for input.'

export const TASK_PERMISSION_MODE_DESCRIPTION =
  'Permission mode for the task. If omitted, inherits the parent session. Raise it only when the task is blocked by permission errors.'

export const TASK_BACKGROUND_DESCRIPTION =
  'Whether to run in background (default: true). If false, waits until the task completes, fails, or becomes blocked waiting for input, then returns the current logs.'

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
}) => {
  const info = params.info
  const safeInfo = (() => {
    if (info == null) {
      return undefined
    }
    const { session, onStop, serverSync, createdAt, ...rest } = info
    return rest
  })()
  return {
    taskId: params.taskId,
    description: params.description ?? info?.description,
    status: info?.status ?? params.status,
    logs: info?.logs ?? [],
    pendingInput: safeInfo?.pendingInteraction,
    ...safeInfo,
    guidance: buildTaskGuidance(safeInfo ?? {})
  }
}
