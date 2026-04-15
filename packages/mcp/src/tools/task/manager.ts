import process from 'node:process'

import { loadInjectDefaultSystemPromptValue, mergeSystemPrompts } from '@vibe-forge/config'
import { callHook } from '@vibe-forge/hooks'
import { generateAdapterQueryOptions, run } from '@vibe-forge/task'
import type {
  AdapterErrorData,
  AdapterOutputEvent,
  AskUserQuestionParams,
  ChatMessage,
  McpTaskSession,
  PermissionInteractionDecision,
  SessionPermissionMode
} from '@vibe-forge/types'
import { createEmptySessionPermissionState, normalizePermissionToolName } from '@vibe-forge/utils'
import type { SessionPermissionState } from '@vibe-forge/utils'
import { extractTextFromMessage } from '@vibe-forge/utils/chat-message'

import { fetchSessionMessages, postSessionEvent } from '#~/sync.js'
import {
  PERMISSION_DECISION_CANCEL,
  applyTaskPermissionDecision,
  buildPermissionRecoveryPayload,
  extractPermissionErrorContext,
  resolvePermissionInteractionDecision,
  syncTaskPermissionStateMirror
} from './permission-recovery'

const TASK_PERMISSION_CONTINUE_PROMPT = '权限规则已更新。请继续刚才被权限拦截的工作，并重试被阻止的操作。'

interface ServerSyncState {
  sessionId: string
  lastEventIndex: number
  lastAssistantMessageId?: string
  seenMessageIds: Set<string>
  lastPollError?: string
  poller?: NodeJS.Timeout
}

export interface PendingTaskInteraction {
  id: string
  payload: AskUserQuestionParams
  source: 'adapter' | 'permission_recovery'
  subjectKeys?: string[]
}

type ManagedTaskSession = McpTaskSession & {
  respondInteraction?: (interactionId: string, data: string | string[]) => void | Promise<void>
}

export interface TaskInfo {
  taskId: string
  adapter?: string
  description: string
  type?: 'default' | 'spec' | 'entity'
  name?: string
  permissionMode?: SessionPermissionMode
  background?: boolean
  status: 'running' | 'waiting_input' | 'completed' | 'failed'
  exitCode?: number
  logs: string[]
  permissionState: SessionPermissionState
  pendingInteraction?: PendingTaskInteraction
  lastError?: AdapterErrorData
  session?: ManagedTaskSession
  createdAt: number
  onStop?: () => void
  serverSync?: ServerSyncState
}

const appendTaskLog = (task: TaskInfo, message: string | undefined) => {
  const normalized = message?.trim()
  if (normalized == null || normalized === '') return
  if (task.logs.at(-1) === normalized) return
  task.logs.push(normalized)
}

const extractMessageLogText = (message: ChatMessage) => {
  const extracted = extractTextFromMessage(message)?.trim()
  if (extracted != null && extracted !== '') {
    return extracted
  }

  if (!Array.isArray(message.content)) {
    return undefined
  }

  for (const item of message.content) {
    if (item.type === 'tool_result') {
      if (typeof item.content === 'string' && item.content.trim() !== '') {
        return item.content.trim()
      }
      try {
        const serialized = JSON.stringify(item.content)
        return serialized === '""' ? undefined : serialized
      } catch {
        return undefined
      }
    }
  }

  return undefined
}

const formatInteractionLog = (payload: AskUserQuestionParams) => {
  const options = payload.options
    ?.map(option => option.value ?? option.label)
    .filter((value): value is string => value.trim() !== '')
  const optionsSuffix = options != null && options.length > 0
    ? ` Available responses: ${options.join(', ')}.`
    : ''
  return `Waiting for ${
    payload.kind === 'permission' ? 'permission' : 'user'
  } input: ${payload.question}${optionsSuffix}`
}

const formatPermissionErrorLog = (error: AdapterErrorData) => {
  if (error.code !== 'permission_required' || error.details == null || typeof error.details !== 'object') {
    return undefined
  }

  const details = error.details as {
    permissionDenials?: Array<{ message?: string; deniedTools?: string[] }>
  }
  const permissionDenials = Array.isArray(details.permissionDenials) ? details.permissionDenials : []
  const deniedTools = [
    ...new Set(permissionDenials.flatMap(item => Array.isArray(item.deniedTools) ? item.deniedTools : []))
  ]
  const reasons = permissionDenials
    .map(item => item.message?.trim())
    .filter((value): value is string => value != null && value !== '')

  const parts = []
  if (deniedTools.length > 0) {
    parts.push(`Denied tools: ${deniedTools.join(', ')}`)
  }
  if (reasons.length > 0) {
    parts.push(`Reasons: ${reasons.join(' | ')}`)
  }

  return parts.length > 0 ? parts.join(' | ') : undefined
}

export class TaskManager {
  private tasks: Map<string, TaskInfo> = new Map()
  private permissionToolUseCache = new Map<string, Map<string, string>>()

  private getPermissionToolUseCache(taskId: string) {
    let cache = this.permissionToolUseCache.get(taskId)
    if (cache == null) {
      cache = new Map<string, string>()
      this.permissionToolUseCache.set(taskId, cache)
    }
    return cache
  }

  private trimPermissionToolUseCache(taskId: string, maxSize = 128) {
    const cache = this.permissionToolUseCache.get(taskId)
    if (cache == null) return

    while (cache.size > maxSize) {
      const firstKey = cache.keys().next().value as string | undefined
      if (firstKey == null) break
      cache.delete(firstKey)
    }
  }

  private rememberPermissionToolUses(taskId: string, message: ChatMessage) {
    if (!Array.isArray(message.content)) {
      return
    }

    const cache = this.getPermissionToolUseCache(taskId)
    for (const item of message.content) {
      if (
        item == null ||
        typeof item !== 'object' ||
        item.type !== 'tool_use' ||
        typeof item.id !== 'string' ||
        item.id.trim() === ''
      ) {
        continue
      }

      const rawName = typeof item.name === 'string' && item.name.trim() !== ''
        ? item.name.trim()
        : undefined
      const normalizedToolName = rawName?.startsWith('adapter:')
        ? rawName.split(':').at(-1)?.trim() ?? rawName
        : rawName
      const subject = normalizePermissionToolName(normalizedToolName ?? rawName)
      if (subject == null) {
        continue
      }

      cache.set(item.id.trim(), subject.key)
    }

    this.trimPermissionToolUseCache(taskId)
  }

  private resolvePermissionErrorContext(taskId: string, error: AdapterErrorData) {
    const context = extractPermissionErrorContext(error)
    if (context.subjectKeys.length > 0) {
      return context
    }

    const details = error.details != null && typeof error.details === 'object'
      ? error.details as Record<string, unknown>
      : {}
    const toolUseId = typeof details.toolUseId === 'string' && details.toolUseId.trim() !== ''
      ? details.toolUseId.trim()
      : undefined
    if (toolUseId == null) {
      return context
    }

    const cachedSubjectKey = this.permissionToolUseCache.get(taskId)?.get(toolUseId)
    if (cachedSubjectKey == null || cachedSubjectKey.trim() === '') {
      return context
    }

    return {
      subjectKeys: [...new Set([...context.subjectKeys, cachedSubjectKey])],
      deniedTools: [...new Set([...context.deniedTools, cachedSubjectKey])],
      reasons: context.reasons
    }
  }

  public async startTask(options: {
    taskId: string
    description: string
    type?: 'default' | 'spec' | 'entity'
    name?: string
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    adapter?: string
    background?: boolean
    enableServerSync?: boolean
  }): Promise<{ taskId: string; logs?: string[] }> {
    const { taskId, adapter, description, type, name, permissionMode, background = true, enableServerSync } = options

    // Initialize Task Info
    const taskInfo: TaskInfo = {
      taskId,
      adapter,
      description,
      type,
      name,
      permissionMode,
      background,
      status: 'running',
      logs: [],
      permissionState: createEmptySessionPermissionState(),
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
    this.permissionToolUseCache.set(taskId, new Map())

    await this.launchTask(taskInfo, 'create')

    if (!background) {
      await new Promise<void>((resolve) => {
        const task = this.tasks.get(taskId)
        if (!task) {
          resolve()
          return
        }
        if (task.status !== 'running') {
          resolve()
          return
        }
        task.onStop = resolve
      })
      return { taskId, logs: taskInfo.logs }
    }

    return { taskId }
  }

  private async launchTask(task: TaskInfo, runType: 'create' | 'resume') {
    try {
      const promptType = task.type !== 'default' ? task.type : undefined
      const promptName = task.name
      const promptCWD = process.cwd()
      const [data, resolvedConfig] = await generateAdapterQueryOptions(
        promptType,
        promptName,
        promptCWD,
        {
          adapter: task.adapter
        }
      )
      const env = {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: process.env.__VF_PROJECT_AI_CTX_ID__ ?? task.taskId
      }
      await callHook('GenerateSystemPrompt', {
        cwd: promptCWD,
        sessionId: task.taskId,
        type: promptType,
        name: promptName,
        data
      }, env)

      const injectDefaultSystemPrompt = await loadInjectDefaultSystemPromptValue(promptCWD)
      const ctxId = process.env.__VF_PROJECT_AI_CTX_ID__ ?? task.taskId
      const { session, resolvedAdapter } = await run({
        adapter: task.adapter,
        cwd: process.cwd(),
        env: {
          ...process.env,
          __VF_PROJECT_AI_CTX_ID__: ctxId
        }
      }, {
        type: runType,
        runtime: 'mcp',
        mode: 'stream',
        sessionId: task.taskId,
        systemPrompt: mergeSystemPrompts({
          generatedSystemPrompt: resolvedConfig.systemPrompt,
          injectDefaultSystemPrompt
        }),
        permissionMode: task.permissionMode,
        tools: resolvedConfig.tools,
        skills: resolvedConfig.skills,
        mcpServers: resolvedConfig.mcpServers,
        promptAssetIds: resolvedConfig.promptAssetIds,
        assetBundle: resolvedConfig.assetBundle,
        onEvent: (event: AdapterOutputEvent) => {
          this.handleEvent(task.taskId, event)
        }
      })

      const current = this.tasks.get(task.taskId)
      if (current == null) {
        session.kill()
        return
      }

      current.adapter = resolvedAdapter ?? current.adapter
      current.session = session as ManagedTaskSession
      current.status = 'running'
      current.exitCode = undefined
      current.pendingInteraction = undefined
      current.lastError = undefined
      try {
        await syncTaskPermissionStateMirror({
          cwd: process.cwd(),
          adapter: current.adapter,
          sessionId: current.taskId,
          permissionState: current.permissionState
        })
      } catch (error) {
        appendTaskLog(
          current,
          `Permission mirror sync failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      this.startServerPolling(task.taskId)
      session.emit({
        type: 'message',
        content: [{
          type: 'text',
          text: runType === 'resume' ? TASK_PERMISSION_CONTINUE_PROMPT : current.description
        }]
      })
    } catch (err) {
      const current = this.tasks.get(task.taskId)
      if (current) {
        current.status = 'failed'
        appendTaskLog(current, `Failed to start task: ${err instanceof Error ? err.message : String(err)}`)
        current.onStop?.()
      }
      throw err
    }
  }

  private handleEvent(taskId: string, event: AdapterOutputEvent) {
    const task = this.tasks.get(taskId)
    if (!task) return

    const shouldSyncEvent = !(task.status === 'failed' && (event.type === 'exit' || event.type === 'stop'))
    if (shouldSyncEvent) {
      void this.syncEvent(task, event)
    }

    switch (event.type) {
      case 'message': {
        const message = event.data as ChatMessage
        this.rememberPermissionToolUses(taskId, message)
        if (message?.id) {
          task.serverSync?.seenMessageIds.add(message.id)
        }
        if (message?.role === 'assistant' && message.id) {
          if (task.serverSync) {
            task.serverSync.lastAssistantMessageId = message.id
          }
        }
        appendTaskLog(task, extractMessageLogText(message))
        break
      }
      case 'interaction_request':
        task.status = 'waiting_input'
        task.pendingInteraction = {
          id: event.data.id,
          payload: event.data.payload,
          source: 'adapter'
        }
        appendTaskLog(task, formatInteractionLog(event.data.payload))
        task.onStop?.()
        break
      case 'error': {
        task.lastError = event.data
        appendTaskLog(task, event.data.message)
        appendTaskLog(task, formatPermissionErrorLog(event.data))
        if (event.data.code === 'permission_required') {
          const permissionContext = this.resolvePermissionErrorContext(taskId, event.data)
          const payload = buildPermissionRecoveryPayload({
            sessionId: task.taskId,
            adapter: task.adapter,
            currentMode: task.permissionMode,
            context: permissionContext
          })
          if (payload != null) {
            task.status = 'waiting_input'
            task.pendingInteraction = {
              id: `task-recovery:${task.taskId}:${Date.now()}`,
              payload,
              source: 'permission_recovery',
              subjectKeys: permissionContext.subjectKeys
            }
            appendTaskLog(task, formatInteractionLog(payload))
            this.stopServerPolling(taskId)
            void this.syncSyntheticInteraction(task)
            task.onStop?.()
            break
          }
        }
        if (event.data.fatal !== false) {
          task.status = 'failed'
          task.pendingInteraction = undefined
          this.stopServerPolling(taskId)
          task.onStop?.()
        }
        break
      }
      case 'stop': {
        task.session = undefined
        if (task.status === 'failed') {
          this.stopServerPolling(taskId)
          task.onStop?.()
          break
        }
        task.status = 'completed'
        task.pendingInteraction = undefined
        this.stopServerPolling(taskId)
        task.onStop?.()
        break
      }
      case 'exit':
        task.session = undefined
        if (task.status === 'failed') {
          task.exitCode = event.data.exitCode ?? undefined
          this.stopServerPolling(taskId)
          task.onStop?.()
          break
        }
        if (task.status === 'waiting_input') {
          task.exitCode = event.data.exitCode ?? undefined
          this.stopServerPolling(taskId)
          task.onStop?.()
          break
        }
        task.status = event.data.exitCode === 0 ? 'completed' : 'failed'
        task.exitCode = event.data.exitCode ?? undefined
        task.pendingInteraction = undefined
        appendTaskLog(task, `Process exited with code ${event.data.exitCode}`)
        this.stopServerPolling(taskId)
        task.onStop?.()
        break
      default:
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
        current.serverSync.lastPollError = undefined
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
      } catch (error) {
        const message = `Sync poll failed: ${error instanceof Error ? error.message : String(error)}`
        if (current.serverSync.lastPollError !== message) {
          current.serverSync.lastPollError = message
          appendTaskLog(current, message)
        }
      }
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
      appendTaskLog(task, `Sync event failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async syncSyntheticInteraction(task: TaskInfo) {
    if (task.serverSync == null || task.pendingInteraction == null) return
    try {
      await postSessionEvent(task.serverSync.sessionId, {
        type: 'interaction_request',
        id: task.pendingInteraction.id,
        payload: task.pendingInteraction.payload
      })
    } catch (error) {
      appendTaskLog(task, `Sync interaction request failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  public getTask(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId)
  }

  public getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values())
  }

  public async submitTaskInput(params: {
    taskId: string
    interactionId?: string
    data: string | string[]
  }): Promise<void> {
    const task = this.tasks.get(params.taskId)
    if (task == null) {
      throw new Error(`Task ${params.taskId} not found.`)
    }

    const pendingInteraction = task.pendingInteraction
    if (pendingInteraction == null) {
      throw new Error(`Task ${params.taskId} does not have a pending interaction.`)
    }

    const interactionId = params.interactionId ?? pendingInteraction.id
    if (interactionId !== pendingInteraction.id) {
      throw new Error(`Interaction ${interactionId} is not pending for task ${params.taskId}.`)
    }

    if (pendingInteraction.source === 'adapter') {
      if (task.session?.respondInteraction == null) {
        throw new Error(`Task ${params.taskId} does not support interaction responses.`)
      }
      await task.session.respondInteraction(interactionId, params.data)
      await this.syncTaskInputResponse(task, interactionId, params.data)
      task.pendingInteraction = undefined
      task.status = 'running'
      const responseText = Array.isArray(params.data) ? params.data.join(', ') : params.data
      appendTaskLog(task, `Interaction response submitted: ${responseText}`)
      return
    }

    const decision = resolvePermissionInteractionDecision(params.data)
    if (decision == null) {
      throw new Error(`Task ${params.taskId} requires a permission decision response.`)
    }

    await this.syncTaskInputResponse(task, interactionId, params.data)
    if (decision === PERMISSION_DECISION_CANCEL) {
      task.pendingInteraction = undefined
      task.status = 'failed'
      appendTaskLog(task, 'Permission recovery cancelled. Task will not continue.')
      task.onStop?.()
      return
    }

    task.permissionState = await applyTaskPermissionDecision({
      cwd: process.cwd(),
      sessionId: task.taskId,
      adapter: task.adapter,
      permissionState: task.permissionState,
      subjectKeys: pendingInteraction.subjectKeys ?? [],
      action: decision as PermissionInteractionDecision
    })

    if (
      decision === 'deny_once' ||
      decision === 'deny_session' ||
      decision === 'deny_project'
    ) {
      task.pendingInteraction = undefined
      task.status = 'failed'
      appendTaskLog(task, `Permission decision applied: ${decision}. Task will not continue.`)
      task.onStop?.()
      return
    }

    task.pendingInteraction = undefined
    task.status = 'running'
    appendTaskLog(task, `Permission decision applied: ${decision}. Restarting task.`)
    await this.launchTask(task, 'resume')
  }

  public async respondToTaskInteraction(params: {
    taskId: string
    interactionId?: string
    data: string | string[]
  }): Promise<void> {
    await this.submitTaskInput(params)
  }

  private async syncTaskInputResponse(task: TaskInfo, interactionId: string, data: string | string[]) {
    if (!task.serverSync) return
    try {
      await postSessionEvent(task.serverSync.sessionId, {
        type: 'interaction_response',
        id: interactionId,
        data
      })
    } catch (error) {
      appendTaskLog(
        task,
        `Sync interaction response failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async syncStoppedTask(params: {
    task: TaskInfo
    pendingInteraction?: PendingTaskInteraction
  }) {
    const { task, pendingInteraction } = params
    if (!task.serverSync) return

    if (pendingInteraction != null) {
      try {
        await postSessionEvent(task.serverSync.sessionId, {
          type: 'interaction_response',
          id: pendingInteraction.id,
          data: PERMISSION_DECISION_CANCEL
        })
      } catch (error) {
        appendTaskLog(
          task,
          `Sync interaction cancellation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    try {
      await postSessionEvent(task.serverSync.sessionId, {
        type: 'error',
        data: {
          message: 'Task stopped by user',
          fatal: true
        }
      })
    } catch (error) {
      appendTaskLog(
        task,
        `Sync stop event failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  public stopTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task && (task.session != null || task.pendingInteraction != null || task.status === 'waiting_input')) {
      const pendingInteraction = task.pendingInteraction
      task.session?.kill()
      task.session = undefined
      task.pendingInteraction = undefined
      appendTaskLog(task, 'Task stopped by user')
      task.status = 'failed' // or 'stopped' if we had that status
      this.stopServerPolling(taskId)
      void this.syncStoppedTask({
        task,
        pendingInteraction
      })
      if (task.onStop) task.onStop()
      return true
    }
    return false
  }
}
