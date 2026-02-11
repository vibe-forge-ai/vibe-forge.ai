import { z } from 'zod'

import { uuid } from '@vibe-forge/core/utils/uuid'

import { createChildSession, getParentSessionId } from '#~/mcp-sync/index.js'

import { defineRegister } from '../types'
import { taskManager } from './manager'

export default defineRegister((server) => {
  server.registerTool(
    'StartTasks',
    {
      title: 'Start Tasks',
      description: 'Start multiple tasks in background or foreground',
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
                  'entity'
                ])
                .describe('The type of definition to load (default, spec or entity)'),
              name: z
                .string()
                .describe('The name of the spec or entity to load, if type is spec or entity. Otherwise, ignored.')
                .optional(),
              adapter: z
                .string()
                .describe('The adapter to use for the task (e.g. claude-code)')
                .optional(),
              background: z
                .boolean()
                .describe(
                  'Whether to run in background (default: true). If false, waits for completion and returns logs.'
                )
                .optional()
            })
          )
          .describe('List of tasks to start')
      })
    },
    async ({ tasks }) => {
      const resolvedTasks = tasks.map(task => ({
        ...task,
        taskId: uuid()
      }))
      const parentSessionId = getParentSessionId()
      const syncResults = parentSessionId
        ? await Promise.allSettled(resolvedTasks.map(task =>
          createChildSession({
            id: task.taskId,
            title: task.name ?? task.description,
            parentSessionId
          })
        ))
        : []
      const results = await Promise.allSettled(resolvedTasks.map((task, idx) => {
        const enableServerSync = parentSessionId != null && syncResults[idx]?.status === 'fulfilled'
        return taskManager.startTask({ ...task, enableServerSync })
      }))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results.map((r, idx) => {
            const { taskId, description } = resolvedTasks[idx]
            const info = taskManager.getTask(taskId)
            const { session, onStop, serverSync, createdAt, ...safeInfo } = info ?? {}
            return {
              taskId,
              description,
              status: info?.status ?? r.status,
              logs: info?.logs ?? [],
              ...safeInfo
            }
          }))
        }]
      }
    }
  )

  server.registerTool(
    'GetTaskInfo',
    {
      title: 'Get Task Info',
      description: 'Get the status and logs of a specific task',
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task to check')
      })
    },
    async ({ taskId }) => {
      const task = taskManager.getTask(taskId)
      if (!task) {
        return {
          content: [{ type: 'text', text: `Task ${taskId} not found.` }],
          isError: true
        }
      }
      const { session, onStop, serverSync, createdAt, ...safeTask } = task
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([safeTask])
        }]
      }
    }
  )

  server.registerTool(
    'StopTask',
    {
      title: 'Stop Task',
      description: 'Stop a running task',
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task to stop')
      })
    },
    async ({ taskId }) => {
      const success = taskManager.stopTask(taskId)
      return {
        content: [{
          type: 'text',
          text: success ? `Task ${taskId} stopped.` : `Failed to stop task ${taskId} (not found or already stopped).`
        }]
      }
    }
  )

  server.registerTool(
    'ListTasks',
    {
      title: 'List Tasks',
      description: 'List all managed tasks',
      inputSchema: z.object({})
    },
    async () => {
      const tasks = taskManager.getAllTasks()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tasks.map(({ session, onStop, serverSync, createdAt, ...task }) => task))
        }]
      }
    }
  )
})
