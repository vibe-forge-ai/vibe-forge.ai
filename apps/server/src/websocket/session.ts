import { cwd as processCwd, env as processEnv } from 'node:process'

import { v4 as uuidv4 } from 'uuid'
import type { WebSocket } from 'ws'

import type {
  AdapterOutputEvent,
  ChatMessage,
  ChatMessageContent,
  Session,
  SessionInfo,
  WSEvent
} from '@vibe-forge/core'
import { generateAdapterQueryOptions, run } from '@vibe-forge/core/controllers/task'
import { callHook } from '@vibe-forge/core/utils/api'

import { getDb } from '#~/db/index.js'
import { applySessionEvent } from '#~/services/sessionEvents.js'
import { handleChannelSessionEvent } from '#~/channels/index.js'
import { getSessionLogger } from '#~/utils/logger.js'

import { adapterCache, externalCache } from './cache'
import { notifySessionUpdated } from './events'
import { getMergedGeneralConfig, maybeNotifySession } from './notifications'
import { sendToClient } from './utils'

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    systemPrompt?: string
    appendSystemPrompt?: boolean
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    promptType?: 'spec' | 'entity'
    promptName?: string
  } = {}
) {
  const db = getDb()
  const historyMessages = db.getMessages(sessionId) as WSEvent[]
  const hasHistory = historyMessages.length > 0
  const serverLogger = getSessionLogger(sessionId, 'server')
  const type = hasHistory ? 'resume' : 'create'

  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    serverLogger.info({ sessionId }, '[server] Reusing existing adapter process')
    return cached
  }

  serverLogger.info({ sessionId, type }, '[server] Starting new adapter process')

  const existing = db.getSession(sessionId)
  if (existing == null) {
    serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
    db.createSession(undefined, sessionId)
  }

  const sockets = new Set<WebSocket>()
  const messages: WSEvent[] = []

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
    const { modelLanguage } = await getMergedGeneralConfig().catch(() => ({ modelLanguage: undefined }))
    const languagePrompt = modelLanguage == null
      ? undefined
      : (modelLanguage === 'en' ? 'Please respond in English.' : '请使用中文进行对话。')
    const mergedSystemPrompt = [
      finalSystemPrompt,
      languagePrompt
    ].filter(Boolean).join('\n\n')
    const { session } = await run({
      env,
      cwd: promptCwd
    }, {
      type,
      runtime: 'server',
      sessionId,
      model: options.model,
      systemPrompt: mergedSystemPrompt,
      permissionMode: options.permissionMode,
      appendSystemPrompt: options.appendSystemPrompt ?? true,
      tools: resolvedConfig.tools,
      mcpServers: resolvedConfig.mcpServers,
      onEvent: (event: AdapterOutputEvent) => {
        const broadcast = (ev: WSEvent) => {
          serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
          messages.push(ev)
          for (const socket of sockets) {
            sendToClient(socket, ev)
          }
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

            for (const socket of sockets) {
              sendToClient(socket, errorEvent)
            }

            adapterCache.delete(sessionId)
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

    const entry = { session, sockets, messages }
    adapterCache.set(sessionId, entry)
    return entry
  } catch (err) {
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

  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.messages.push(ev)
    for (const socket of cached.sockets) {
      sendToClient(socket, ev)
    }

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
    const externalCached = externalCache.get(sessionId)
    if (externalCached != null) {
      externalCached.messages.push(ev)
      for (const socket of externalCached.sockets) {
        sendToClient(socket, ev)
      }
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
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    getSessionLogger(sessionId, 'server').info({ sessionId }, '[server] Killing adapter process by request')
    cached.session.kill()
    adapterCache.delete(sessionId)
    updateAndNotifySession(sessionId, { status: 'terminated' })
  }
}
