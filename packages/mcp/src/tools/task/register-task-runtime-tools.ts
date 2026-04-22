import { z } from 'zod'

import type { Register } from '../types'
import type { TaskManager } from './manager'
import {
  DEFAULT_TASK_LOG_LIMIT,
  GET_TASK_INFO_DESCRIPTION,
  LIST_TASKS_DESCRIPTION,
  RESPOND_TASK_INTERACTION_DESCRIPTION,
  SEND_TASK_MESSAGE_DESCRIPTION,
  STOP_TASK_DESCRIPTION,
  SUBMIT_TASK_INPUT_DESCRIPTION,
  TASK_LOG_LIMIT_DESCRIPTION,
  TASK_LOG_ORDER_DESCRIPTION,
  TASK_LOG_ORDERS,
  serializeTaskInfo
} from './presentation'

export const registerTaskRuntimeTools = (
  server: Parameters<Register>[0],
  taskManager: TaskManager
) => {
  server.registerTool(
    'GetTaskInfo',
    {
      title: 'Get Task Info',
      description: GET_TASK_INFO_DESCRIPTION,
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task to check'),
        logLimit: z
          .number()
          .int()
          .min(1)
          .describe(TASK_LOG_LIMIT_DESCRIPTION)
          .default(DEFAULT_TASK_LOG_LIMIT),
        logOrder: z
          .enum(TASK_LOG_ORDERS)
          .describe(TASK_LOG_ORDER_DESCRIPTION)
          .default('desc')
      })
    },
    async ({ taskId, logLimit, logOrder }) => {
      const task = taskManager.getTask(taskId)
      if (!task) {
        return {
          content: [{ type: 'text', text: `Task ${taskId} not found.` }],
          isError: true
        }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([serializeTaskInfo({ taskId, info: task, logLimit, logOrder })])
        }]
      }
    }
  )

  server.registerTool(
    'SendTaskMessage',
    {
      title: 'Send Task Message',
      description: SEND_TASK_MESSAGE_DESCRIPTION,
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the running task to continue'),
        message: z
          .string()
          .trim()
          .min(1)
          .describe('The follow-up instruction to send to the task'),
        mode: z
          .enum(['direct', 'steer'])
          .describe('How to deliver the message: direct (default) or steer')
          .default('direct')
      })
    },
    async ({ taskId, message, mode }) => {
      await taskManager.sendTaskMessage({
        taskId,
        message,
        mode
      })
      const task = taskManager.getTask(taskId)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([serializeTaskInfo({
            taskId,
            info: task,
            logLimit: DEFAULT_TASK_LOG_LIMIT,
            logOrder: 'desc'
          })])
        }]
      }
    }
  )

  server.registerTool(
    'SubmitTaskInput',
    {
      title: 'Submit Task Input',
      description: SUBMIT_TASK_INPUT_DESCRIPTION,
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task that is waiting for input'),
        interactionId: z
          .string()
          .describe('Optional interaction ID. Omit it when the task only has one pending input.')
          .optional(),
        data: z
          .union([z.string(), z.array(z.string()).min(1)])
          .describe('The input to submit. Prefer pendingInput.payload.options[].value when available.')
      })
    },
    async ({ taskId, interactionId, data }) => {
      await taskManager.submitTaskInput({
        taskId,
        interactionId,
        data
      })
      const task = taskManager.getTask(taskId)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([serializeTaskInfo({
            taskId,
            info: task,
            logLimit: DEFAULT_TASK_LOG_LIMIT,
            logOrder: 'desc'
          })])
        }]
      }
    }
  )

  server.registerTool(
    'RespondTaskInteraction',
    {
      title: 'Respond Task Interaction',
      description: RESPOND_TASK_INTERACTION_DESCRIPTION,
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task that is waiting for input'),
        interactionId: z
          .string()
          .describe('Optional interaction ID. Omit it when the task only has one pending interaction.')
          .optional(),
        response: z
          .union([z.string(), z.array(z.string()).min(1)])
          .describe('The selected answer. Prefer pendingInteraction.options[].value when available.')
      })
    },
    async ({ taskId, interactionId, response }) => {
      await taskManager.submitTaskInput({
        taskId,
        interactionId,
        data: response
      })
      const task = taskManager.getTask(taskId)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([serializeTaskInfo({
            taskId,
            info: task,
            logLimit: DEFAULT_TASK_LOG_LIMIT,
            logOrder: 'desc'
          })])
        }]
      }
    }
  )

  server.registerTool(
    'StopTask',
    {
      title: 'Stop Task',
      description: STOP_TASK_DESCRIPTION,
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
      description: LIST_TASKS_DESCRIPTION,
      inputSchema: z.object({
        logLimit: z
          .number()
          .int()
          .min(1)
          .describe(TASK_LOG_LIMIT_DESCRIPTION)
          .default(DEFAULT_TASK_LOG_LIMIT),
        logOrder: z
          .enum(TASK_LOG_ORDERS)
          .describe(TASK_LOG_ORDER_DESCRIPTION)
          .default('desc')
      })
    },
    async ({ logLimit, logOrder }) => {
      const tasks = taskManager.getAllTasks()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tasks.map(task => serializeTaskInfo({
            taskId: task.taskId,
            info: task,
            logLimit,
            logOrder
          })))
        }]
      }
    }
  )
}
