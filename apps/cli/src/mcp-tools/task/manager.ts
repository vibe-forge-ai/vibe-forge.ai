import process from 'node:process'

import type { AdapterOutputEvent, AdapterSession } from '@vibe-forge/core'
import { generateAdapterQueryOptions, run } from '@vibe-forge/core/controllers/task'

export interface TaskInfo {
  taskId: string
  adapter?: string
  status: 'running' | 'completed' | 'failed'
  exitCode?: number
  logs: string[]
  session?: AdapterSession
  createdAt: number
  onStop?: () => void
}

class TaskManager {
  private tasks: Map<string, TaskInfo> = new Map()

  public async startTask(options: {
    taskId: string
    description: string
    type?: 'default' | 'spec' | 'entity'
    name?: string
    adapter?: string
    background?: boolean
  }): Promise<{ taskId: string; logs?: string[] }> {
    const { taskId, adapter, description, type, name, background = true } = options

    // Initialize Task Info
    const taskInfo: TaskInfo = {
      taskId,
      adapter,
      status: 'running',
      logs: [],
      createdAt: Date.now()
    }
    this.tasks.set(taskId, taskInfo)

    try {
      // Resolve Config
      const resolvedConfig = await generateAdapterQueryOptions(
        type !== 'default' ? type : undefined,
        name,
        process.cwd()
      )

      // Start Task
      const { session } = await run({
        adapter,
        cwd: process.cwd(),
        env: process.env
      }, {
        type: 'create',
        runtime: 'mcp',
        mode: 'stream',
        sessionId: taskId,
        systemPrompt: resolvedConfig.systemPrompt,
        tools: resolvedConfig.tools,
        skills: resolvedConfig.skills,
        mcpServers: resolvedConfig.mcpServers,
        onEvent: (event) => {
          this.handleEvent(taskId, event)
        }
      })
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
          task.onStop = resolve
        })
        return { taskId, logs: taskInfo.logs }
      }
    } catch (err) {
      const task = this.tasks.get(taskId)
      if (task) {
        task.status = 'failed'
        task.logs.push(`Failed to start task: ${err instanceof Error ? err.message : String(err)}`)
        task.onStop?.()
      }
      throw err
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
      case 'stop': {
        task.status = 'completed'
        task.onStop?.()
        break
      }
      case 'exit':
        task.status = event.data.exitCode === 0 ? 'completed' : 'failed'
        task.exitCode = event.data.exitCode ?? undefined
        task.logs.push(`Process exited with code ${event.data.exitCode}`)
        task.onStop?.()
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
      if (task.onStop) task.onStop()
      return true
    }
    return false
  }
}

export const taskManager = new TaskManager()
