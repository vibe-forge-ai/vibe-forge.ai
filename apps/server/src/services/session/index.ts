import { cwd as processCwd, env as processEnv } from 'node:process'

import { v4 as uuidv4 } from 'uuid'

import type { ChatMessage, ChatMessageContent, Session, SessionPermissionMode, WSEvent } from '@vibe-forge/core'
import type { AdapterOutputEvent, SessionInfo } from '@vibe-forge/core/adapter'
import { generateAdapterQueryOptions, run } from '@vibe-forge/core/controllers/task'
import { callHook } from '@vibe-forge/core/utils/api'

import { handleChannelSessionEvent } from '#~/channels/index.js'
import { getDb } from '#~/db/index.js'
import { loadMergedConfig } from '#~/services/config/index.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { maybeNotifySession } from '#~/services/session/notification.js'
import {
  bindAdapterSessionRuntime,
  broadcastSessionEvent,
  createSessionConnectionState,
  deleteAdapterSessionRuntime,
  emitRuntimeEvent,
  getAdapterSessionRuntime,
  getExternalSessionRuntime,
  notifySessionUpdated,
  setAdapterSessionRuntime
} from '#~/services/session/runtime.js'
import { getSessionLogger } from '#~/utils/logger.js'

const activeAdapterRunStore = new Map<string, string>()

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    systemPrompt?: string
    appendSystemPrompt?: boolean
    permissionMode?: SessionPermissionMode
    promptType?: 'spec' | 'entity'
    promptName?: string
    adapter?: string
  } = {}
) {
  const db = getDb()
  const historyMessages = db.getMessages(sessionId) as WSEvent[]
  const hasHistory = historyMessages.length > 0
  const serverLogger = getSessionLogger(sessionId, 'server')
  const type = hasHistory ? 'resume' : 'create'
  const existing = db.getSession(sessionId)
  const resolvedModel = options.model ?? existing?.model
  const resolvedAdapter = options.adapter ?? existing?.adapter
  const resolvedPermissionMode = options.permissionMode ?? existing?.permissionMode

  const cached = getAdapterSessionRuntime(sessionId)
  if (cached != null) {
    const currentModel = cached.config?.model ?? existing?.model
    const currentAdapter = cached.config?.adapter ?? existing?.adapter
    const currentPermissionMode = cached.config?.permissionMode ?? existing?.permissionMode
    const configChanged = (
      currentModel !== resolvedModel ||
      currentAdapter !== resolvedAdapter ||
      currentPermissionMode !== resolvedPermissionMode
    )

    if (!configChanged) {
      serverLogger.info({ sessionId }, '[server] Reusing existing adapter process')
      return cached
    }

    serverLogger.info({
      sessionId,
      currentModel,
      resolvedModel,
      currentAdapter,
      resolvedAdapter,
      currentPermissionMode,
      resolvedPermissionMode
    }, '[server] Restarting adapter process due to session config change')
    activeAdapterRunStore.delete(sessionId)
    cached.session.kill()
    deleteAdapterSessionRuntime(sessionId)
  }

  serverLogger.info({ sessionId, type }, '[server] Starting new adapter process')

  if (existing == null) {
    serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
    db.createSession(undefined, sessionId)
  }

  if (
    resolvedModel !== existing?.model || resolvedAdapter !== existing?.adapter ||
    resolvedPermissionMode !== existing?.permissionMode
  ) {
    updateAndNotifySession(sessionId, {
      model: resolvedModel,
      adapter: resolvedAdapter,
      permissionMode: resolvedPermissionMode
    })
  }

  const connectionState = createSessionConnectionState()
  const runId = uuidv4()
  activeAdapterRunStore.set(sessionId, runId)

  try {
    const promptCwd = processCwd()
    const [data, resolvedConfig] = await generateAdapterQueryOptions(
      options.promptType,
      options.promptName,
      promptCwd
    )
    const env = {
      ...processEnv,
      __VF_PROJECT_AI_CTX_ID__: processEnv.__VF_PROJECT_AI_CTX_ID__ ?? sessionId
    }
    await callHook('GenerateSystemPrompt', {
      cwd: promptCwd,
      sessionId,
      type: options.promptType,
      name: options.promptName,
      data
    }, env)
    const finalSystemPrompt = [resolvedConfig.systemPrompt, options.systemPrompt]
      .filter(Boolean)
      .join('\n\n')
    const { mergedConfig } = await loadMergedConfig().catch(() => ({ mergedConfig: {} as { modelLanguage?: string } }))
    const { modelLanguage } = mergedConfig
    const languagePrompt = modelLanguage == null
      ? undefined
      : (modelLanguage === 'en' ? 'Please respond in English.' : '请使用中文进行对话。')
    const mergedSystemPrompt = [
      finalSystemPrompt,
      languagePrompt
    ].filter(Boolean).join('\n\n')
    const { session } = await run({
      env,
      cwd: promptCwd,
      adapter: resolvedAdapter
    }, {
      type,
      runtime: 'server',
      sessionId,
      model: resolvedModel,
      systemPrompt: mergedSystemPrompt,
      permissionMode: resolvedPermissionMode,
      appendSystemPrompt: options.appendSystemPrompt ?? true,
      tools: resolvedConfig.tools,
      mcpServers: resolvedConfig.mcpServers,
      onEvent: (event: AdapterOutputEvent) => {
        if (activeAdapterRunStore.get(sessionId) !== runId) {
          return
        }

        const broadcast = (ev: WSEvent) => {
          serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
          emitRuntimeEvent(connectionState, ev)
        }

        const applyEvent = (ev: WSEvent) => {
          applySessionEvent(sessionId, ev, {
            broadcast,
            onSessionUpdated: (session) => {
              notifySessionUpdated(sessionId, session)
            }
          })
          void handleChannelSessionEvent(sessionId, ev).catch(() => undefined)
        }

        switch (event.type) {
          case 'init':
            if ('model' in (event.data as any)) {
              updateAndNotifySession(sessionId, {
                model: typeof (event.data as any).model === 'string'
                  ? (event.data as any).model
                  : resolvedModel,
                adapter: typeof (event.data as any).adapter === 'string'
                  ? (event.data as any).adapter
                  : resolvedAdapter,
                permissionMode: resolvedPermissionMode
              })
              applyEvent({
                type: 'session_info',
                info: {
                  type: 'init',
                  ...(event.data as any)
                } as SessionInfo
              })
            }
            break
          case 'message':
            if ('role' in (event.data as any)) {
              applyEvent({
                type: 'message',
                message: event.data
              })
            }
            break
          case 'exit': {
            const { exitCode, stderr } = event.data as { exitCode: number; stderr: string }
            const errorEvent: WSEvent = {
              type: 'error',
              message: exitCode !== 0
                ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                : 'Process exited unexpectedly'
            }

            updateAndNotifySession(sessionId, {
              status: exitCode === 0 ? 'completed' : 'failed'
            })

            emitRuntimeEvent(connectionState, errorEvent, { recordMessage: false })

            deleteAdapterSessionRuntime(sessionId)
            if (activeAdapterRunStore.get(sessionId) === runId) {
              activeAdapterRunStore.delete(sessionId)
            }
            break
          }
          case 'summary': {
            const summaryData = event.data as { summary: string; leafUuid: string }
            applyEvent({
              type: 'session_info',
              info: {
                type: 'summary',
                summary: summaryData.summary,
                leafUuid: summaryData.leafUuid
              }
            })
            break
          }
          case 'stop': {
            updateAndNotifySession(sessionId, { status: 'completed' })
            break
          }
        }
      }
    })

    return setAdapterSessionRuntime(sessionId, bindAdapterSessionRuntime(connectionState, session, {
      runId,
      model: resolvedModel,
      adapter: resolvedAdapter,
      permissionMode: resolvedPermissionMode
    }))
  } catch (err) {
    if (activeAdapterRunStore.get(sessionId) === runId) {
      activeAdapterRunStore.delete(sessionId)
    }
    updateAndNotifySession(sessionId, { status: 'failed' })
    serverLogger.error({ err, sessionId }, '[server] session init error')
    throw err
  }
}

function extractTextFromContent(content: ChatMessageContent[]) {
  const textItem = content.find(
    (item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text' && item.text.trim() !== ''
  )
  return textItem?.text
}

export function processUserMessage(sessionId: string, content: string | ChatMessageContent[]) {
  const serverLogger = getSessionLogger(sessionId, 'server')
  const userText = typeof content === 'string' ? String(content ?? '') : ''
  const contentItems: ChatMessageContent[] = Array.isArray(content)
    ? content
    : [{ type: 'text', text: userText }]
  const summaryText = extractTextFromContent(contentItems) ?? '[图片]'
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: Array.isArray(content) ? contentItems : userText,
    createdAt: Date.now()
  }

  const ev: WSEvent = { type: 'message', message: userMessage }
  const db = getDb()
  db.saveMessage(sessionId, ev)

  const currentSessionData = db.getSession(sessionId)
  const updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>> = {
    lastMessage: summaryText,
    lastUserMessage: summaryText,
    status: 'running'
  }

  if (
    currentSessionData?.title == null || currentSessionData.title === '' ||
    currentSessionData.title === 'New Session'
  ) {
    const firstLine = summaryText.split('\n')[0].trim()
    updates.title = firstLine.length > 50 ? `${firstLine.slice(0, 50)}...` : firstLine
  }

  updateAndNotifySession(sessionId, updates)

  const cached = getAdapterSessionRuntime(sessionId)
  if (cached != null) {
    broadcastSessionEvent(sessionId, ev)

    const messageList = cached.messages

    const lastAssistantMessage = messageList
      .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
        m.type === 'message' && m.message.role === 'assistant' && (m.message.id != null && m.message.id !== '')
      )
      .pop()

    const parentUuid = lastAssistantMessage != null ? lastAssistantMessage.message.id : undefined

    cached.session.emit({
      type: 'message',
      content: contentItems,
      parentUuid
    })
  } else {
    const externalCached = getExternalSessionRuntime(sessionId)
    if (externalCached != null) {
      broadcastSessionEvent(sessionId, ev)
      return
    }
    serverLogger.warn({ sessionId }, '[server] Adapter session not found when processing user message')
  }
}

export function updateAndNotifySession(
  id: string,
  updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>
) {
  const db = getDb()
  const previous = db.getSession(id)
  db.updateSession(id, updates)
  const updated = db.getSession(id)
  if (updated) {
    notifySessionUpdated(id, updated)
    void maybeNotifySession(previous?.status, updated.status, updated).catch(() => undefined)
  }
}

export function killSession(sessionId: string) {
  const cached = getAdapterSessionRuntime(sessionId)
  if (cached != null) {
    activeAdapterRunStore.delete(sessionId)
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Killing adapter process by request')
    cached.session.kill()
    deleteAdapterSessionRuntime(sessionId)
    updateAndNotifySession(sessionId, { status: 'terminated' })
  }
}

export function interruptSession(sessionId: string) {
  const cached = getAdapterSessionRuntime(sessionId)
  if (cached != null) {
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Interrupting adapter process by request')
    cached.session.emit({ type: 'interrupt' })
  }
}
