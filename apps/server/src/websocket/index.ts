import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { cwd as processCwd, env as processEnv } from 'node:process'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

import type { ChatMessage, SessionInfo, WSEvent } from '@vibe-forge/core'

import { query } from '#~/adapters/index.js'
import type { AdapterOutputEvent, AdapterSession } from '#~/adapters/index.js'
import { getDb } from '#~/db.js'
import type { ServerEnv } from '#~/env.js'
import { getSessionLogger } from '#~/utils/logger.js'

function sendToClient(ws: WebSocket, event: WSEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event))
  }
}

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.WS_PATH })

  // 记录 sessionId 对应的 process (adapter) 和相关的 sockets
  // 使用 Map 因为 sessionId 是字符串。如果需要自动清理，我们在 close 时手动处理。
  const adapterCache = new Map<string, {
    session: AdapterSession
    sockets: Set<WebSocket>
    messages: WSEvent[]
  }>()

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
    const params = url.searchParams

    const sessionId = params.get('sessionId') ?? uuidv4()
    const model = params.get('model') ?? undefined

    // 自动判断 type: 如果 session 已经存在于数据库且有消息记录，则使用 resume，否则使用 create
    const db = getDb()
    const historyMessages = db.getMessages(sessionId) as WSEvent[]
    const hasHistory = historyMessages.length > 0
    const serverLogger = getSessionLogger(sessionId, 'server')
    serverLogger.info({ sessionId, historyCount: historyMessages.length, hasHistory }, '[server] history check')
    const type = hasHistory ? 'resume' : 'create'

    serverLogger.info({ sessionId, type }, '[server] Connection established')

    const systemPrompt = params.get('systemPrompt') ?? undefined
    const appendSystemPrompt = params.get('appendSystemPrompt') !== 'false'

    // 用于当前 socket 闭包引用的 adapter session
    let currentSession: AdapterSession | null = null

    // 尝试复用已有的 adapter session
    const cached = adapterCache.get(sessionId)

    // 如果已存在该 sessionId 的 session，则复用
    if (cached != null) {
      serverLogger.info({ sessionId }, '[server] Reusing existing adapter process')
      cached.sockets.add(ws)
      currentSession = cached.session

      // 重放内存中的历史消息
      for (const msg of cached.messages) {
        sendToClient(ws, msg)
      }
    } else {
      serverLogger.info({ sessionId, type }, '[server] Starting new adapter process')

      // 确保数据库中有该 session
      const existing = db.getSession(sessionId)
      if (existing == null) {
        serverLogger.info({ sessionId }, '[server] Session not found in DB, creating new entry')
        db.createSession(sessionId === 'default' ? '默认会话' : `会话 ${sessionId.slice(0, 8)}`, sessionId)
      }

      // 重放从数据库加载历史消息给当前 socket
      if (hasHistory) {
        serverLogger.info({ sessionId, historyCount: historyMessages.length }, '[server] Replaying messages from DB')
        for (const msg of historyMessages) {
          sendToClient(ws, msg)
        }
      }

      const sockets = new Set<WebSocket>([ws])
      const messages = [...historyMessages]

      try {
        const session = query('claude', {
          env: processEnv as Record<string, string>,
          cwd: processCwd(),
          type,
          sessionId,
          model,
          systemPrompt,
          appendSystemPrompt,
          onEvent: (event: AdapterOutputEvent) => {
            if (event.data == null) return

            // 广播给所有关联的 sockets 并存入历史记录
            const broadcast = (ev: WSEvent) => {
              serverLogger.info({ event: 'broadcast', data: ev }, 'Broadcasting event')
              messages.push(ev)
              getDb().saveMessage(sessionId, ev)
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

                currentSession = null
                // 从缓存中移除
                adapterCache.delete(sessionId)
                break
              }
              case 'raw':
                // 可以选择是否发送 raw 事件给客户端，目前保留 adapter_event 类型
                broadcast({ type: 'adapter_event', data: event.data as unknown })
                break
              case 'summary': {
                const summaryData = event.data as { summary: string; leafUuid: string }
                // 更新数据库标题
                getDb().updateSessionTitle(sessionId, summaryData.summary)
                // 广播 summary 事件给前端
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

        currentSession = session
        adapterCache.set(sessionId, { session, sockets, messages })
      } catch (err) {
        serverLogger.error({ err, sessionId }, '[server] session init error')
        sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as { type: string; text?: string }
        serverLogger.info({ event: 'user_input', data: msg }, 'Received user message')
        if (msg.type === 'user_message') {
          const userText = String(msg.text ?? '')
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
          if (cached != null) {
            cached.messages.push(ev)
            for (const socket of cached.sockets) {
              sendToClient(socket, ev)
            }
          } else {
            // 理论上如果是新会话，currentSession 还没建好或者正在建
            sendToClient(ws, ev)
          }

          if (currentSession != null) {
            const currentCached = adapterCache.get(sessionId)
            const messageList = currentCached != null ? currentCached.messages : []

            // 获取最后一条助手消息的 id (即 uuid) 作为 parentUuid
            const lastAssistantMessage = messageList
              .filter((m: WSEvent): m is Extract<WSEvent, { type: 'message' }> =>
                m.type === 'message' && m.message.role === 'assistant' && (m.message.id != null && m.message.id !== '')
              )
              .pop()

            const parentUuid = lastAssistantMessage != null ? lastAssistantMessage.message.id : undefined

            currentSession.emit({
              type: 'message',
              content: [{ type: 'text', text: userText }],
              parentUuid
            })
          }
        } else if (msg.type === 'interrupt') {
          serverLogger.info({ sessionId }, '[server] Received interrupt request')
          if (currentSession != null) {
            currentSession.emit({ type: 'interrupt' })
          }
        }
      } catch (err) {
        sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    })

    ws.on('close', () => {
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
      } else if (currentSession != null) {
        // 对于不在缓存中的 session，直接 kill
        serverLogger.info({ sessionId }, '[server] Closing non-cached session')
        currentSession.kill()
      }
    })
  })

  return wss
}
