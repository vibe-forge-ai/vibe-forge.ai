import type { TaskInfo } from './manager'
import { DEFAULT_TASK_LOG_LIMIT, serializeTaskInfo } from './presentation'
import type { TaskLogsOrder } from './presentation'

interface TextContent {
  type: 'text'
  text: string
}

export const createTextContent = (text: string): TextContent[] => [{
  type: 'text',
  text
}]

export const createSerializedTaskInfoContent = (params: {
  taskId: string
  info?: TaskInfo
  logLimit?: number
  logOrder?: TaskLogsOrder
}) =>
  createTextContent(JSON.stringify([serializeTaskInfo({
    taskId: params.taskId,
    info: params.info,
    logLimit: params.logLimit ?? DEFAULT_TASK_LOG_LIMIT,
    logOrder: params.logOrder ?? 'desc'
  })]))

export const createSerializedTaskListContent = (
  tasks: TaskInfo[],
  logLimit: number,
  logOrder: TaskLogsOrder
) =>
  createTextContent(JSON.stringify(tasks.map(task =>
    serializeTaskInfo({
      taskId: task.taskId,
      info: task,
      logLimit,
      logOrder
    })
  )))
