import type { Buffer } from 'node:buffer'
import type { Server } from 'node:http'
import { URL } from 'node:url'

import { v4 as uuidv4 } from 'uuid'
import { WebSocketServer } from 'ws'

import type { ServerEnv } from '@vibe-forge/core'
import { WORKSPACE_TERMINAL_SESSION_ID } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import {
  AUTH_COOKIE_NAME,
  getCookieFromHeader,
  resolveWebAuthConfig,
  verifySessionToken
} from '#~/services/auth/index.js'
import { interruptSession, killSession, processUserMessage, startAdapterSession } from '#~/services/session/index.js'
import { handleInteractionResponse } from '#~/services/session/interaction.js'
import {
  addSessionSubscriberSocket,
  attachSocketToSession,
  detachSocketFromSession,
  getAdapterSessionRuntime,
  removeSessionSubscriberSocket
} from '#~/services/session/runtime.js'
import { safeJsonStringify } from '#~/utils/json.js'
import { getSessionLogger } from '#~/utils/logger.js'
import { handleTerminalSocketConnection, sendTerminalFatalError } from './terminal'

export function setupWebSocket(server: Server, env: ServerEnv) {
  const wss = new WebSocketServer({ server, path: env.__VF_PROJECT_AI_SERVER_WS_PATH__ })

  wss.on('connection', async (ws, req) => {
    const authConfig = await resolveWebAuthConfig(env)
    if (authConfig.enabled) {
      const token = getCookieFromHeader(req.headers.cookie, AUTH_COOKIE_NAME)
      const authenticated = await verifySessionToken(env, token)
      if (!authenticated) {
        ws.close(1008, 'Login required')
        return
      }
    }

    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
    const params = url.searchParams
    const subscribeMode = params.get('subscribe')
    const channel = params.get('channel')

    if (subscribeMode === 'sessions') {
      addSessionSubscriberSocket(ws)
      ws.on('close', () => {
        removeSessionSubscriberSocket(ws)
      })
      return
    }

    const sessionId = params.get('sessionId') ?? uuidv4()

    if (channel === 'terminal') {
      const isWorkspaceTerminal = sessionId === WORKSPACE_TERMINAL_SESSION_ID
      const session = isWorkspaceTerminal ? undefined : getDb().getSession(sessionId)
      if (!isWorkspaceTerminal && session == null) {
        sendTerminalFatalError(ws, 'Session not found.', 1008)
        return
      }

      await handleTerminalSocketConnection(ws, sessionId, params)
      return
    }

    const model = params.get('model') ?? undefined
    const effort = params.get('effort') ?? undefined
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
      const sessionRuntimeState = db.getSessionRuntimeState(sessionId)
      const isExternalSession = sessionRuntimeState?.runtimeKind === 'external'
      const cachedRuntime = getAdapterSessionRuntime(sessionId)
      const shouldAutoStartAdapter = sessionData == null ||
        sessionData.status === 'running' ||
        sessionData.status === 'waiting_input'

      if (isExternalSession) {
        attachSocketToSession(sessionId, ws, 'external')
      } else if (cachedRuntime != null) {
        attachSocketToSession(sessionId, ws, 'adapter')
      } else if (shouldAutoStartAdapter) {
        const cached = await startAdapterSession(sessionId, {
          model,
          effort: effort as 'low' | 'medium' | 'high' | 'max' | undefined,
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
      } else {
        attachSocketToSession(sessionId, ws, 'external')
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        const message = err instanceof Error ? err.message : String(err)
        ws.send(safeJsonStringify({
          type: 'error',
          data: { message, fatal: true },
          message
        }))
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
          void processUserMessage(sessionId, content)
        } else if (msg.type === 'interrupt') {
          serverLogger.info({ sessionId }, '[server] Received interrupt request')
          const sessionRuntimeState = getDb().getSessionRuntimeState(sessionId)
          if (sessionRuntimeState?.runtimeKind !== 'external') {
            interruptSession(sessionId)
          }
        } else if (msg.type === 'terminate_session') {
          serverLogger.info({ sessionId }, '[server] Received terminate_session request')
          killSession(sessionId)
        }
      } catch (err) {
        if (ws.readyState === WebSocket.OPEN) {
          const message = err instanceof Error ? err.message : String(err)
          ws.send(safeJsonStringify({
            type: 'error',
            data: { message, fatal: true },
            message
          }))
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
