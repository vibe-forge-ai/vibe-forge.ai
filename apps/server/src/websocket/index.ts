import { URL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { type WebSocket, WebSocketServer } from 'ws'

import { type AdapterOutputEvent, type AdapterSession, query } from '#~/adapters/index.js'
import { getDb } from '#~/db.js'
import type { ServerEnv } from '#~/env.js'
import type { ChatMessage } from '#~/types.js'
import { getSessionLogger } from '#~/utils/logger.js'

type WSEvent =
  | { type: 'error'; message: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'session_info'; info: any }
  | { type: 'tool_result'; toolCallId: string; output: any; isError: boolean }
  | { type: 'adapter_result'; result: any; usage?: any }
  | { type: 'adapter_event'; data: any }

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

export function setupWebSocket(server: any, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.WS_PATH })

  // 记录 sessionId 对应的 process (adapter) 和相关的 sockets
  // 使用 Map 因为 sessionId 是字符串。如果需要自动清理，我们在 close 时手动处理。
  const adapterCache = new Map<string, {
    session: AdapterSession
    sockets: Set<WebSocket>
    messages: WSEvent[]
  }>()

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
    const params = url.searchParams

    const sessionId = params.get('sessionId') || uuidv4()
    const model = params.get('model') || undefined

    // 自动判断 type: 如果 session 已经存在于数据库且有消息记录，则使用 resume，否则使用 create
    const db = getDb()
    const historyMessages = db.getMessages(sessionId) as WSEvent[]
    const hasHistory = historyMessages.length > 0
    console.log(`[server] [${sessionId}] history count: ${historyMessages.length}, hasHistory: ${hasHistory}`)
    const type = hasHistory ? 'resume' : 'create'

    console.log(`[server] [${sessionId}] Connection established. Auto-detected type: ${type}`)

    const serverLogger = getSessionLogger(sessionId, 'server')
    serverLogger.info({ event: 'connection', type, sessionId, model }, 'Connection established')

    const systemPrompt = params.get('systemPrompt') || undefined
    const appendSystemPrompt = params.get('appendSystemPrompt') !== 'false'

    // 用于当前 socket 闭包引用的 adapter session
    let currentSession: AdapterSession | null = null

    // 尝试复用已有的 adapter session
    let cached = adapterCache.get(sessionId)

    // 如果已存在该 sessionId 的 session，则复用
    if (cached) {
      console.log(`[server] [${sessionId}] Reusing existing adapter process`)
      cached.sockets.add(ws)
      currentSession = cached.session

      // 重放内存中的历史消息
      for (const msg of cached.messages) {
        sendToClient(ws, msg)
      }
    } else {
      console.log(`[server] [${sessionId}] Starting new adapter process (type: ${type})`)

      // 确保数据库中有该 session
      const existing = db.getSession(sessionId)
      if (!existing) {
        console.log(`[server] [${sessionId}] Session not found in DB, creating new entry`)
        db.createSession(sessionId === 'default' ? '默认会话' : `会话 ${sessionId.slice(0, 8)}`, sessionId)
      }

      // 重放从数据库加载的历史消息给当前 socket
      if (hasHistory) {
        console.log(`[server] [${sessionId}] Replaying ${historyMessages.length} messages from DB`)
        for (const msg of historyMessages) {
          sendToClient(ws, msg)
        }
      }

      const sockets = new Set<WebSocket>([ws])
      const messages = [...historyMessages]

      try {
        const session = query('claude', {
          env: process.env as Record<string, string>,
          cwd: process.cwd(),
          type: type as 'create' | 'resume',
          sessionId,
          model,
          systemPrompt,
          appendSystemPrompt,
          onEvent: (event: AdapterOutputEvent) => {
            const { type, data } = event
            if (!data) return

            // 广播给所有关联的 sockets 并存入历史记录
            const broadcast = (ev: WSEvent) => {
              serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
              messages.push(ev)
              getDb().saveMessage(sessionId, ev)
              for (const socket of sockets) {
                sendToClient(socket, ev)
              }
            }

            switch (type) {
              case 'init':
                broadcast({
                  type: 'session_info',
                  info: data
                })
                break
              case 'message':
                broadcast({
                  type: 'message',
                  message: data
                })
                break
              case 'exit':
                const { exitCode, stderr } = data
                const errorEvent: WSEvent = {
                  type: 'error',
                  message: exitCode !== 0
                    ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                    : 'Process exited unexpectedly'
                }

                for (const socket of sockets) {
                  sendToClient(socket, errorEvent)
                }

                currentSession = null
                // 从缓存中移除
                adapterCache.delete(sessionId)
                break
              case 'raw':
                // 可以选择是否发送 raw 事件给客户端，目前保留 adapter_event 类型
                broadcast({ type: 'adapter_event', data })
                break
              case 'summary':
                // 更新数据库标题
                getDb().updateSessionTitle(sessionId, data.summary)
                // 广播 summary 事件给前端
                broadcast({
                  type: 'session_info',
                  info: {
                    type: 'summary',
                    summary: data.summary,
                    leafUuid: data.leafUuid
                  }
                })
                break
            }
          }
        })

        currentSession = session
        adapterCache.set(sessionId, { session, sockets, messages })
      } catch (err) {
        console.error('[server] session init error:', err)
        sendToClient(ws, { type: 'error', message: `${err}` })
      }
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any
        serverLogger.info({ event: 'user_input', data: msg }, 'Received user message')
        if (msg.type === 'user_message') {
          const userText = String(msg.text || '')
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

          const cached = adapterCache.get(sessionId)
          if (cached) {
            cached.messages.push(ev)
            for (const socket of cached.sockets) {
              sendToClient(socket, ev)
            }
          } else {
            // 理论上如果是新会话，currentSession 还没建好或者正在建
            sendToClient(ws, ev)
          }

          if (currentSession) {
            const currentCached = adapterCache.get(sessionId)
            const messageList = currentCached ? currentCached.messages : []

            // 获取最后一条助手消息的 id (即 uuid) 作为 parentUuid
            const lastAssistantMessage = messageList
              .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
                m.type === 'message' && m.message.role === 'assistant' && !!m.message.id
              )
              .pop()

            const parentUuid = lastAssistantMessage ? lastAssistantMessage.message.id : undefined

            currentSession.emit({
              type: 'message',
              content: [{ type: 'text', text: userText }],
              parentUuid
            })
          }
        } else if (msg.type === 'interrupt') {
          console.log(`[server] [${sessionId}] Received interrupt request`)
          if (currentSession) {
            currentSession.emit({ type: 'interrupt' })
          }
        }
      } catch (err) {
        sendToClient(ws, { type: 'error', message: `${err}` })
      }
    })

    ws.on('close', () => {
      const cached = adapterCache.get(sessionId)
      if (cached) {
        cached.sockets.delete(ws)
        // 只有当所有关联的 socket 都关闭时，才 kill session
        if (cached.sockets.size === 0) {
          console.log(`[server] All sockets for session ${sessionId} closed, killing adapter process`)
          cached.session.kill()
          adapterCache.delete(sessionId)
        } else {
          console.log(
            `[server] Socket closed, but session ${sessionId} still has ${cached.sockets.size} active sockets`
          )
        }
      } else if (currentSession) {
        // 对于不在缓存中的 session，直接 kill
        console.log(`[server] Closing non-cached session ${sessionId}`)
        currentSession.kill()
      }
    })
  })

  return wss
}
