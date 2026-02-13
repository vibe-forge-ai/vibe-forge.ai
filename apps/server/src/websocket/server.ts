import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'

import type { ServerEnv, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db.js'
import { applySessionEvent } from '#~/services/sessionEvents.js'
import { getSessionLogger } from '#~/utils/logger.js'

import { adapterCache, externalCache, globalSockets, pendingInteractions } from './cache'
import { broadcastSessionEvent, notifySessionUpdated } from './events'
import { clearSessionInteraction } from './interactions'
import { killSession, processUserMessage, startAdapterSession, updateAndNotifySession } from './session'
import { sendToClient } from './utils'

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.__VF_PROJECT_AI_SERVER_WS_PATH__ })

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
      const db = getDb()
      const sessionData = db.getSession(sessionId)
      const isExternalSession = sessionData?.parentSessionId != null

      if (isExternalSession) {
        const externalCached = externalCache.get(sessionId) ?? { sockets: new Set<WebSocket>(), messages: [] }
        externalCached.sockets.add(ws)
        externalCache.set(sessionId, externalCached)
      } else {
        const cached = await startAdapterSession(sessionId, {
          model,
          systemPrompt,
          appendSystemPrompt
        })
        cached.sockets.add(ws)
      }
    } catch (err) {
      sendToClient(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) })
      return
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any

        if (msg.type === 'interaction_response') {
          const { id, data } = msg
          const sessionData = getDb().getSession(sessionId)
          const isExternalSession = sessionData?.parentSessionId != null
          if (isExternalSession) {
            clearSessionInteraction(sessionId, id)
            const event: WSEvent = { type: 'interaction_response', id, data }
            applySessionEvent(sessionId, event, {
              broadcast: (ev) => broadcastSessionEvent(sessionId, ev),
              onSessionUpdated: (session) => {
                notifySessionUpdated(sessionId, session)
              }
            })
            return
          }
          const pending = pendingInteractions.get(id)

          if (pending) {
            clearTimeout(pending.timer)
            clearSessionInteraction(sessionId, id)
            updateAndNotifySession(sessionId, { status: 'running' })
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
          const sessionData = getDb().getSession(sessionId)
          if (sessionData?.parentSessionId == null) {
            const cached = adapterCache.get(sessionId)
            if (cached != null) {
              cached.session.emit({ type: 'interrupt' })
            }
          }
        } else if (msg.type === 'terminate_session') {
          serverLogger.info({ sessionId }, '[server] Received terminate_session request')
          killSession(sessionId)
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
        if (cached.sockets.size === 0) {
          serverLogger.info({ sessionId }, '[server] All sockets closed, but keeping adapter process alive')
        } else {
          serverLogger.info(
            { sessionId, activeSockets: cached.sockets.size },
            '[server] Socket closed, but session still has active sockets'
          )
        }
        return
      }
      const externalCached = externalCache.get(sessionId)
      if (externalCached != null) {
        externalCached.sockets.delete(ws)
        if (externalCached.sockets.size === 0) {
          externalCache.delete(sessionId)
        }
      }
    })
  })

  return wss
}
