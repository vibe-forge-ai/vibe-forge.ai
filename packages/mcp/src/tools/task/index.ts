import process from 'node:process'

import { callHook } from '@vibe-forge/hooks'
import { uuid } from '@vibe-forge/utils/uuid'
import { z } from 'zod'

import { createChildSession, getParentSessionId } from '#~/sync.js'
import type { McpManagedTaskInput } from '../../types'
import { defineRegister } from '../types'
import { TaskManager } from './manager'
import {
  SESSION_PERMISSION_MODES,
  START_TASKS_DESCRIPTION,
  TASK_BACKGROUND_DESCRIPTION,
  TASK_MODEL_DESCRIPTION,
  TASK_PERMISSION_MODE_DESCRIPTION,
  resolveInheritedPermissionMode,
  serializeTaskInfo
} from './presentation'
import { registerTaskRuntimeTools } from './register-task-runtime-tools'

export const createTaskRegister = () => {
  const taskManager = new TaskManager()

  return defineRegister((server) => {
    server.registerTool(
      'StartTasks',
      {
        title: 'Start Tasks',
        description: START_TASKS_DESCRIPTION,
        inputSchema: z.object({
          tasks: z
            .array(
              z.object({
                description: z
                  .string()
                  .describe('The description or prompt for the task'),
                type: z
                  .enum([
                    'default',
                    'spec',
                    'entity',
                    'workspace'
                  ])
                  .describe('The type of definition to load (default, spec, entity or workspace)'),
                name: z
                  .string()
                  .describe('The name of the spec or entity to load, if type is spec or entity. Otherwise, ignored.')
                  .optional(),
                adapter: z
                  .string()
                  .describe('The adapter to use for the task (e.g. claude-code)')
                  .optional(),
                model: z
                  .string()
                  .describe(TASK_MODEL_DESCRIPTION)
                  .optional(),
                permissionMode: z
                  .enum(SESSION_PERMISSION_MODES)
                  .describe(TASK_PERMISSION_MODE_DESCRIPTION)
                  .optional(),
                background: z
                  .boolean()
                  .describe(TASK_BACKGROUND_DESCRIPTION)
                  .optional()
              })
            )
            .describe('List of tasks to start')
        })
      },
      async ({ tasks }) => {
        const inheritedPermissionMode = resolveInheritedPermissionMode()
        const resolvedTasks = tasks.map((task): McpManagedTaskInput & {
          taskId: string
          type: NonNullable<McpManagedTaskInput['type']>
        } => ({
          ...task,
          permissionMode: task.permissionMode ?? inheritedPermissionMode,
          type: task.type ?? 'default',
          taskId: uuid()
        }))
        const parentSessionId = getParentSessionId()

        await callHook('StartTasks', {
          cwd: process.cwd(),
          sessionId: process.env.__VF_PROJECT_AI_SESSION_ID__!,
          tasks: resolvedTasks
        })
        const syncResults = parentSessionId
          ? await Promise.allSettled(resolvedTasks.map(task =>
            createChildSession({
              id: task.taskId,
              title: task.name ?? task.description,
              parentSessionId,
              permissionMode: task.permissionMode
            })
          ))
          : []
        const results = await Promise.allSettled(resolvedTasks
          .map((task, idx) =>
            taskManager.startTask({
              ...task,
              enableServerSync: parentSessionId != null && syncResults[idx]?.status === 'fulfilled'
            })
          ))

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results.map((r, idx) => {
              const { taskId, description } = resolvedTasks[idx]
              return serializeTaskInfo({
                taskId,
                description,
                status: r.status === 'rejected' ? 'failed' : 'running',
                info: taskManager.getTask(taskId)
              })
            }))
          }]
        }
      }
    )

    registerTaskRuntimeTools(server, taskManager)
  })
}
