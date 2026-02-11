import process from 'node:process'

import type { AdapterOutputEvent, AdapterSession, ChatMessage } from '@vibe-forge/core'
import { generateAdapterQueryOptions, run } from '@vibe-forge/core/controllers/task'

import { extractTextFromMessage, fetchSessionMessages, postSessionEvent } from '#~/mcp-sync/index.js'

interface ServerSyncState {
  sessionId: string
  lastEventIndex: number
  lastAssistantMessageId?: string
  seenMessageIds: Set<string>
  poller?: NodeJS.Timeout
}

export interface TaskInfo {
  taskId: string
  adapter?: string
  description: string
  type?: 'default' | 'spec' | 'entity'
  name?: string
  background?: boolean
  status: 'running' | 'completed' | 'failed'
  exitCode?: number
  logs: string[]
  session?: AdapterSession
  createdAt: number
  onStop?: () => void
  serverSync?: ServerSyncState
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
    enableServerSync?: boolean
  }): Promise<{ taskId: string; logs?: string[] }> {
    const { taskId, adapter, description, type, name, background = true, enableServerSync } = options

    // Initialize Task Info
    const taskInfo: TaskInfo = {
      taskId,
      adapter,
      description,
      type,
      name,
      background,
      status: 'running',
      logs: [],
      createdAt: Date.now()
    }
    if (enableServerSync) {
      taskInfo.serverSync = {
        sessionId: taskId,
        lastEventIndex: 0,
        seenMessageIds: new Set()
      }
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
      const parentCtxId = process.env.__VF_PROJECT_AI_CTX_ID__
      const { session } = await run({
        adapter,
        cwd: process.cwd(),
        env: {
          ...process.env,
          __VF_PROJECT_AI_CTX_ID__: taskId
        }
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
        this.startServerPolling(taskId)
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

    void this.syncEvent(task, event)

    switch (event.type) {
      case 'message': {
        const message = event.data as ChatMessage
        if (message?.id) {
          task.serverSync?.seenMessageIds.add(message.id)
        }
        if (message?.role === 'assistant' && message.id) {
          if (task.serverSync) {
            task.serverSync.lastAssistantMessageId = message.id
          }
        }
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
        this.stopServerPolling(taskId)
        task.onStop?.()
        break
      }
      case 'exit':
        task.status = event.data.exitCode === 0 ? 'completed' : 'failed'
        task.exitCode = event.data.exitCode ?? undefined
        task.logs.push(`Process exited with code ${event.data.exitCode}`)
        this.stopServerPolling(taskId)
        task.onStop?.()
        break
    }
  }

  private startServerPolling(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task?.serverSync) return
    if (task.serverSync.poller) return

    const poll = async () => {
      const current = this.tasks.get(taskId)
      if (!current?.serverSync || !current.session) return
      try {
        const events = await fetchSessionMessages(current.serverSync.sessionId)
        const startIndex = current.serverSync.lastEventIndex
        const newEvents = events.slice(startIndex)
        current.serverSync.lastEventIndex = events.length

        for (const ev of newEvents) {
          if (ev.type !== 'message') continue
          if (ev.message.role !== 'user') continue
          if (ev.message.id && current.serverSync.seenMessageIds.has(ev.message.id)) {
            continue
          }
          if (ev.message.id) {
            current.serverSync.seenMessageIds.add(ev.message.id)
          }
          const text = extractTextFromMessage(ev.message).trim()
          if (text === '') continue
          current.session.emit({
            type: 'message',
            content: [{ type: 'text', text }],
            parentUuid: current.serverSync.lastAssistantMessageId
          })
        }
      } catch {}
    }

    task.serverSync.poller = setInterval(() => {
      void poll()
    }, 1000)
    void poll()
  }

  private stopServerPolling(taskId: string) {
    const task = this.tasks.get(taskId)
    if (task?.serverSync?.poller) {
      clearInterval(task.serverSync.poller)
      task.serverSync.poller = undefined
    }
  }

  private async syncEvent(task: TaskInfo, event: AdapterOutputEvent) {
    if (!task.serverSync) return
    try {
      await postSessionEvent(task.serverSync.sessionId, event as unknown as Record<string, unknown>)
    } catch (err) {
      task.logs.push(`Sync event failed: ${err instanceof Error ? err.message : String(err)}`)
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
      this.stopServerPolling(taskId)
      if (task.onStop) task.onStop()
      return true
    }
    return false
  }
}

export const taskManager = new TaskManager()
