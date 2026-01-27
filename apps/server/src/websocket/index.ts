import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { cwd as processCwd, env as processEnv } from 'node:process'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

import type {
  AdapterOutputEvent,
  AdapterSession,
  AskUserQuestionParams,
  ChatMessage,
  ChatMessageContent,
  ServerEnv,
  Session,
  SessionInfo,
  WSEvent
} from '@vibe-forge/core'
import { run } from '@vibe-forge/core/controllers/task'

import { getDb } from '#~/db.js'
import { getSessionLogger } from '#~/utils/logger.js'

function extractTextFromMessage(message: ChatMessage): string | undefined {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    const textContent = message.content.find((c: ChatMessageContent) => c.type === 'text')
    if (textContent != null && 'text' in textContent) {
      return textContent.text
    }
  }
  return undefined
}

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

// 记录 sessionId 对应的 process (adapter) 和相关的 sockets
// 使用 Map 因为 sessionId 是字符串。如果需要自动清理，我们在 close 时手动处理。
const adapterCache = new Map<string, {
  session: AdapterSession
  sockets: Set<WebSocket>
  messages: WSEvent[]
}>()

// Store all connected sockets globally to broadcast session updates
const globalSockets = new Set<WebSocket>()

// Store pending interactions
const pendingInteractions = new Map<string, {
  resolve: (data: string | string[]) => void
  reject: (reason: any) => void
  timer: NodeJS.Timeout
}>()

export async function startAdapterSession(
  sessionId: string,
  options: {
    model?: string
    systemPrompt?: string
    appendSystemPrompt?: boolean
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

  // 确保数据库中有该 session
  const existing = db.getSession(sessionId)
  if (existing == null) {
    serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
    db.createSession(undefined, sessionId)
  }

  const sockets = new Set<WebSocket>()
  const messages: WSEvent[] = []

  // Pre-create the cache entry so onEvent can access it
  // But we can't set the session yet.
  // We'll update the session property later.
  // Actually run() awaits.
  // We can pass the `sockets` set to onEvent via closure.

  try {
    const { session } = await run({
      env: processEnv as Record<string, string>,
      cwd: processCwd()
    }, {
      type,
      runtime: 'server',
      sessionId,
      model: options.model,
      systemPrompt: options.systemPrompt,
      appendSystemPrompt: options.appendSystemPrompt ?? true,
      onEvent: (event: AdapterOutputEvent) => {
        if (event.data == null) return

        // 广播给所有关联的 sockets 并存入历史记录
        const broadcast = (ev: WSEvent) => {
          serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
          messages.push(ev)
          const db = getDb()
          db.saveMessage(sessionId, ev)

          // 更新会话的最后一条消息字段
          if (ev.type === 'message') {
            const text = extractTextFromMessage(ev.message)
            if (text != null && text !== '') {
              updateAndNotifySession(sessionId, {
                lastMessage: text,
                lastUserMessage: ev.message.role === 'user' ? text : undefined
              })
            }
          }

          for (const socket of sockets) {
            sendToClient(socket, ev)
          }
        }

        switch (event.type) {
          case 'init':
            if ('model' in (event.data as any)) {
              broadcast({
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
              broadcast({
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

            for (const socket of sockets) {
              sendToClient(socket, errorEvent)
            }

            // 从缓存中移除
            adapterCache.delete(sessionId)
            break
          }
          case 'summary': {
            const summaryData = event.data as { summary: string; leafUuid: string }
            // 广播 summary 事件给前端，但不更新数据库
            broadcast({
              type: 'session_info',
              info: {
                type: 'summary',
                summary: summaryData.summary,
                leafUuid: summaryData.leafUuid
              }
            })
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

export function processUserMessage(sessionId: string, text: string) {
  const serverLogger = getSessionLogger(sessionId, 'server')
  const userText = String(text ?? '')
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userText,
    createdAt: Date.now()
  }

  // 存入历史并广播
  const ev: WSEvent = { type: 'message', message: userMessage }
  const db = getDb()
  db.saveMessage(sessionId, ev)

  // 记录最后一条用户消息和最后一条消息到数据库，并同步更新标题（如果尚未设置）
  const currentSessionData = db.getSession(sessionId)
  const updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>> = {
    lastMessage: userText,
    lastUserMessage: userText
  }

  if (
    currentSessionData?.title == null || currentSessionData.title === '' ||
    currentSessionData.title === 'New Session'
  ) {
    // 提取第一行或者前50个字符作为标题
    const firstLine = userText.split('\n')[0].trim()
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

    // 获取最后一条助手消息的 id (即 uuid) 作为 parentUuid
    const lastAssistantMessage = messageList
      .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
        m.type === 'message' && m.message.role === 'assistant' && (m.message.id != null && m.message.id !== '')
      )
      .pop()

    const parentUuid = lastAssistantMessage != null ? lastAssistantMessage.message.id : undefined

    cached.session.emit({
      type: 'message',
      content: [{ type: 'text', text: userText }],
      parentUuid
    })
  } else {
    serverLogger.warn({ sessionId }, '[server] Adapter session not found when processing user message')
  }
}

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.WS_PATH })

  wss.on('connection', async (ws, req) => {
    globalSockets.add(ws)
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
    const params = url.searchParams

    const sessionId = params.get('sessionId') ?? uuidv4()
    const model = params.get('model') ?? undefined
    const systemPrompt = params.get('systemPrompt') ?? undefined
    const appendSystemPrompt = params.get('appendSystemPrompt') !== 'false'

    const serverLogger = getSessionLogger(sessionId, 'server')
    serverLogger.info({ sessionId }, '[server] Connection established')

    try {
      const cached = await startAdapterSession(sessionId, {
        model,
        systemPrompt,
        appendSystemPrompt
      })
      cached.sockets.add(ws)
    } catch (err) {
      sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      return
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        
        if (msg.type === 'interaction_response') {
          const { id, data } = msg
          const pending = pendingInteractions.get(id)
          
          if (pending) {
            clearTimeout(pending.timer)
            pending.resolve(data)
            pendingInteractions.delete(id)
          }
          return
        }

        serverLogger.info({ event: 'user_input', data: msg }, 'Received user message')
        if (msg.type === 'user_message') {
          processUserMessage(sessionId, msg.text)
        } else if (msg.type === 'interrupt') {
          serverLogger.info({ sessionId }, '[server] Received interrupt request')
          const cached = adapterCache.get(sessionId)
          if (cached != null) {
            cached.session.emit({ type: 'interrupt' })
          }
        }
      } catch (err) {
        sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    })

    ws.on('close', () => {
      globalSockets.delete(ws)
      const cached = adapterCache.get(sessionId)
      if (cached != null) {
        cached.sockets.delete(ws)
        // 只有当所有关联的 socket 都关闭时，才 kill session
        if (cached.sockets.size === 0) {
          serverLogger.info({ sessionId }, '[server] All sockets closed, killing adapter process')
          cached.session.kill()
          adapterCache.delete(sessionId)
        } else {
          serverLogger.info(
            { sessionId, activeSockets: cached.sockets.size },
            '[server] Socket closed, but session still has active sockets'
          )
        }
      }
    })
  })

  return wss
}

export function notifySessionUpdated(sessionId: string, session: Session | { id: string; isDeleted: boolean }) {
  const event: WSEvent = { type: 'session_updated', session }
  for (const socket of globalSockets) {
    sendToClient(socket, event)
  }
}

export function updateAndNotifySession(
  id: string,
  updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>
) {
  const db = getDb()
  db.updateSession(id, updates)
  const updated = db.getSession(id)
  if (updated) {
    notifySessionUpdated(id, updated)
  }
}
