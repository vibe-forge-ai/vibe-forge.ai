import process from 'node:process'

import type { AdapterOutputEvent, AdapterSession } from '@vibe-forge/core'
import { resolveTaskConfig, run } from '@vibe-forge/core/controllers/task'
import { uuid } from '@vibe-forge/core/utils/uuid'

export interface TaskInfo {
  taskId: string
  adapter?: string
  status: 'running' | 'completed' | 'failed'
  exitCode?: number
  logs: string[]
  session?: AdapterSession
  createdAt: number
  onExit?: () => void
}

class TaskManager {
  private static instance: TaskManager
  private tasks: Map<string, TaskInfo> = new Map()

  private constructor() {}

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager()
    }
    return TaskManager.instance
  }

  public async startTask(options: {
    description: string
    type?: 'spec' | 'entity'
    name?: string
    adapter?: string
    background?: boolean
  }): Promise<{ taskId: string; logs?: string[] }> {
    const taskId = uuid()
    const { adapter, description, type, name, background = true } = options

    // Initialize Task Info
    const taskInfo: TaskInfo = {
      taskId,
      adapter,
      status: 'running',
      logs: [],
      createdAt: Date.now()
    }
    this.tasks.set(taskId, taskInfo)

    // Resolve Config
    const resolvedConfig = await resolveTaskConfig(type, name, process.cwd())

    // Start Task
    const runPromise = run({
      taskId,
      taskAdapter: adapter,
      cwd: process.cwd(),
      env: process.env
    }, {
      type: 'create',
      runtime: 'cli',
      sessionId: taskId, // Use taskId as sessionId for simplicity in this context
      model: undefined, // Let adapter choose default or from config
      systemPrompt: resolvedConfig.systemPrompt,
      mode: 'direct', // CLI background tasks usually run in direct mode
      tools: resolvedConfig.tools,
      mcpServers: resolvedConfig.mcpServers,
      onEvent: (event: AdapterOutputEvent) => {
        this.handleEvent(taskId, event)
      }
    }).then(({ session }) => {
      // Store session for control
      const task = this.tasks.get(taskId)
      if (task) {
        task.session = session
        // Send initial prompt (description)
        session.emit({
          type: 'message',
          content: [{ type: 'text', text: description }]
        })
      }
      return session
    }).catch((err) => {
      const task = this.tasks.get(taskId)
      if (task) {
        task.status = 'failed'
        task.logs.push(`Failed to start task: ${err.message}`)
        if (task.onExit) task.onExit()
      }
      throw err
    })

    if (!background) {
      // Wait for completion
      await new Promise<void>((resolve) => {
        const task = this.tasks.get(taskId)
        if (!task) {
          resolve()
          return
        }
        // Check if already finished
        if (task.status !== 'running') {
          resolve()
          return
        }
        // Register callback
        task.onExit = resolve
      })
      return { taskId, logs: taskInfo.logs }
    }

    return { taskId }
  }

  private handleEvent(taskId: string, event: AdapterOutputEvent) {
    const task = this.tasks.get(taskId)
    if (!task) return

    switch (event.type) {
      case 'message': {
        const content = event.data.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content.map(c => c.type === 'text' ? c.text : '').join('')
        }
        if (text) {
          task.logs.push(text)
        }
        break
      }
      case 'exit':
        task.status = event.data.exitCode === 0 ? 'completed' : 'failed'
        task.exitCode = event.data.exitCode ?? undefined
        task.logs.push(`Process exited with code ${event.data.exitCode}`)
        if (task.onExit) task.onExit()
        break
    }
  }

  public getTask(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId)
  }

  public getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values())
  }

  public stopTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task && task.session) {
      task.session.kill()
      task.logs.push('Task stopped by user')
      task.status = 'failed' // or 'stopped' if we had that status
      if (task.onExit) task.onExit()
      return true
    }
    return false
  }
}

export const taskManager = TaskManager.getInstance()
