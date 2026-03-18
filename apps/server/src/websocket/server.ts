import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import { WebSocketServer } from 'ws'

import type { ServerEnv } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { interruptSession, killSession, processUserMessage, startAdapterSession } from '#~/services/session/index.js'
import { handleInteractionResponse } from '#~/services/session/interaction.js'
import {
  addSessionSubscriberSocket,
  attachSocketToSession,
  detachSocketFromSession,
  removeSessionSubscriberSocket
} from '#~/services/session/runtime.js'
import { safeJsonStringify } from '#~/utils/json.js'
import { getSessionLogger } from '#~/utils/logger.js'

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.__VF_PROJECT_AI_SERVER_WS_PATH__ })

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
    const params = url.searchParams
    const subscribeMode = params.get('subscribe')

    if (subscribeMode === 'sessions') {
      addSessionSubscriberSocket(ws)
      ws.on('close', () => {
        removeSessionSubscriberSocket(ws)
      })
      return
    }

    const sessionId = params.get('sessionId') ?? uuidv4()
    const model = params.get('model') ?? undefined
    const systemPrompt = params.get('systemPrompt') ?? undefined
    const appendSystemPrompt = params.get('appendSystemPrompt') !== 'false'
    const permissionMode = params.get('permissionMode') ?? undefined
    const promptTypeRaw = params.get('type') ?? undefined
    const promptType = promptTypeRaw === 'spec' || promptTypeRaw === 'entity'
      ? promptTypeRaw
      : undefined
    const promptName = params.get('name') ?? undefined
    const adapter = params.get('adapter') ?? undefined

    const serverLogger = getSessionLogger(sessionId, 'server')
    serverLogger.info({ sessionId }, '[server] Connection established')

    try {
      const db = getDb()
      const sessionData = db.getSession(sessionId)
      const isExternalSession = sessionData?.parentSessionId != null

      if (isExternalSession) {
        attachSocketToSession(sessionId, ws, 'external')
      } else {
        const cached = await startAdapterSession(sessionId, {
          model,
          systemPrompt,
          appendSystemPrompt,
          permissionMode: permissionMode as
            | 'default'
            | 'acceptEdits'
            | 'plan'
            | 'dontAsk'
            | 'bypassPermissions'
            | undefined,
          promptType,
          promptName,
          adapter
        })
        attachSocketToSession(sessionId, ws, 'adapter')
        if (cached == null) {
          throw new Error(`Failed to initialize session runtime for ${sessionId}`)
        }
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(safeJsonStringify({ type: 'error', message: err instanceof Error ? err.message : String(err) }))
      }
      return
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw)) as any

        if (msg.type === 'interaction_response') {
          const { id, data } = msg
          handleInteractionResponse(sessionId, id, data)
          return
        }

        serverLogger.info({ event: 'user_input', data: msg }, 'Received user message')
        if (msg.type === 'user_message') {
          const content = msg.content ?? msg.text
          processUserMessage(sessionId, content)
        } else if (msg.type === 'interrupt') {
          serverLogger.info({ sessionId }, '[server] Received interrupt request')
          const sessionData = getDb().getSession(sessionId)
          if (sessionData?.parentSessionId == null) {
            interruptSession(sessionId)
          }
        } else if (msg.type === 'terminate_session') {
          serverLogger.info({ sessionId }, '[server] Received terminate_session request')
          killSession(sessionId)
        }
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(safeJsonStringify({ type: 'error', message: err instanceof Error ? err.message : String(err) }))
        }
      }
    })

    ws.on('close', () => {
      const runtime = detachSocketFromSession(sessionId, ws)
      const cached = runtime != null && 'session' in runtime ? runtime : undefined
      if (cached != null) {
        if (cached.sockets.size === 0) {
          serverLogger.info({ sessionId }, '[server] All sockets closed, but keeping adapter process alive')
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
