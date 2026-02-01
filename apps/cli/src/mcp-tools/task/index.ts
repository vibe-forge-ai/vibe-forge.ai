import { z } from 'zod'

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
                  'spec',
                  'entity'
                ])
                .describe('The type of definition to load (spec or entity)')
                .optional(),
              name: z
                .string()
                .describe('The name of the spec or entity to load')
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
      const results = await Promise.all(tasks.map(task => taskManager.startTask(task)))

      const startedTasks = results.map(r => r.taskId)
      const logs = results.map(r => r.logs).filter(Boolean)

      let message = `Started ${tasks.length} tasks.\nTask IDs: ${startedTasks.join(', ')}`

      if (logs.length > 0) {
        // dprint-ignore
        message += (
          `\n\nExecution Logs:\n` +
          `${
            logs.map((l, i) => (
              `--- Task ${startedTasks[i]} Start ---\n` +
              `${l?.join('\n')}\n` +
              `--- Task ${startedTasks[i]} End ---\n`
            )).join('\n\n')
          }`
        )
      } else {
        message += `\n\nPlease use 'GetTaskStatus' to check progress (for background tasks).`
      }

      return {
        content: [{
          type: 'text',
          text: message
        }]
      }
    }
  )

  server.registerTool(
    'GetTaskStatus',
    {
      title: 'Get Task Status',
      description: 'Check the status and logs of a specific task',
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

      // Return last 10 log lines to keep context manageable
      const recentLogs = task.logs.slice(-10).join('\n')

      return {
        content: [{
          type: 'text',
          text: `Task ID: ${task.taskId}\nStatus: ${task.status}\nExit Code: ${
            task.exitCode ?? 'N/A'
          }\n\nRecent Logs:\n${recentLogs}`
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
      if (tasks.length === 0) {
        return { content: [{ type: 'text', text: 'No tasks found.' }] }
      }
      const list = tasks.map(t => `- [${t.status.toUpperCase()}] ${t.taskId} (Adapter: ${t.adapter})`).join('\n')
      return {
        content: [{
          type: 'text',
          text: `Current Tasks:\n${list}`
        }]
      }
    }
  )
})
