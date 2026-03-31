import Router from '@koa/router'

import type { ChatMessage, ChatMessageContent, WSEvent } from '@vibe-forge/core'
import type { SessionInfo, SessionInitInfo } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { killSession, updateAndNotifySession } from '#~/services/session/index.js'
import {
  clearSessionInteraction,
  getSessionInteraction,
  setSessionInteraction
} from '#~/services/session/interaction.js'
import { broadcastSessionEvent, notifySessionUpdated } from '#~/services/session/runtime.js'
import { badRequest, methodNotAllowed, notFound } from '#~/utils/http.js'

export function sessionsRouter(): Router {
  const router = new Router()
  const db = getDb()

  const parseLimit = (limit?: string) => {
    if (limit == null) {
      return null
    }

    const n = Number.parseInt(limit, 10)
    return Number.isNaN(n) ? null : n
  }

  router.get(['/', ''], (ctx) => {
    ctx.body = { sessions: db.getSessions('active') }
  })

  router.get('/archived', (ctx) => {
    ctx.body = { sessions: db.getSessions('archived') }
  })

  router.get('/:id/messages', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { limit } = ctx.query as { limit?: string }
    const messages = db.getMessages(id)
    const session = db.getSession(id)
    const interaction = getSessionInteraction(id)

    const parsedLimit = parseLimit(limit)
    const responseMessages = parsedLimit == null ? messages : messages.slice(-parsedLimit)
    ctx.body = { messages: responseMessages, session, interaction }
  })

  router.patch('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { title, isStarred, isArchived, tags } = ctx.request.body as {
      title?: string
      isStarred?: boolean
      isArchived?: boolean
      tags?: string[]
    }

    if (title !== undefined || isStarred !== undefined) {
      updateAndNotifySession(id, { title, isStarred })
    }

    if (isArchived !== undefined) {
      const updatedIds = db.updateSessionArchivedWithChildren(id, isArchived)
      for (const updatedId of updatedIds) {
        const updatedSession = db.getSession(updatedId)
        if (updatedSession != null) {
          notifySessionUpdated(updatedId, updatedSession)
        }
      }
    }

    if (tags !== undefined) {
      db.updateSessionTags(id, tags)
      const updatedSession = db.getSession(id)
      if (updatedSession != null) {
        notifySessionUpdated(id, updatedSession)
      }
    }

    ctx.body = { ok: true }
  })

  router.post(['/', ''], async (ctx) => {
    const {
      id,
      title,
      initialMessage,
      initialContent,
      parentSessionId,
      start,
      model,
      effort,
      promptType,
      promptName,
      permissionMode,
      adapter
    } = ctx.request.body as {
      id?: string
      title?: string
      initialMessage?: string
      initialContent?: ChatMessageContent[]
      parentSessionId?: string
      start?: boolean
      model?: string
      effort?: 'low' | 'medium' | 'high' | 'max'
      promptType?: 'spec' | 'entity'
      promptName?: string
      permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
      adapter?: string
    }
    const session = await createSessionWithInitialMessage({
      title,
      initialMessage,
      initialContent,
      parentSessionId,
      id,
      shouldStart: start !== false,
      model,
      effort,
      promptType,
      promptName,
      permissionMode,
      adapter
    })
    ctx.body = { session }
  })

  router.post('/:id/events', (ctx) => {
    const { id } = ctx.params as { id: string }
    const existing = db.getSession(id)
    if (existing == null) {
      throw notFound('Session not found', { id }, 'session_not_found')
    }

    const body = ctx.request.body as {
      type?: string
      data?: any
      message?: ChatMessage | string
      summary?: string
      leafUuid?: string
      id?: string
      payload?: any
      exitCode?: number
      stderr?: string
    }

    const onSessionUpdated = (session: any) => {
      notifySessionUpdated(id, session)
    }

    if (body.type === 'message' && body.data != null) {
      const event: WSEvent = { type: 'message', message: body.data }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'message' && body.message != null && typeof body.message !== 'string') {
      const event: WSEvent = { type: 'message', message: body.message }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'summary' && body.data?.summary) {
      const info: SessionInfo = {
        type: 'summary',
        summary: body.data.summary,
        leafUuid: body.data.leafUuid ?? ''
      }
      const event: WSEvent = { type: 'session_info', info }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'summary' && typeof body.summary === 'string') {
      const info: SessionInfo = {
        type: 'summary',
        summary: body.summary,
        leafUuid: body.leafUuid ?? ''
      }
      const event: WSEvent = { type: 'session_info', info }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'init' && body.data) {
      const infoData = body.data as SessionInitInfo
      const info: SessionInfo = {
        ...infoData,
        type: 'init'
      }
      const event: WSEvent = { type: 'session_info', info }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'interaction_request' && body.id && body.payload) {
      const event: WSEvent = {
        type: 'interaction_request',
        id: body.id,
        payload: body.payload
      }
      setSessionInteraction(id, { id: body.id, payload: body.payload })
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'interaction_response' && body.id && body.data != null) {
      const event: WSEvent = {
        type: 'interaction_response',
        id: body.id,
        data: body.data
      }
      clearSessionInteraction(id, body.id)
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'error' && body.data?.message) {
      const event: WSEvent = {
        type: 'error',
        data: body.data,
        message: body.data.message
      }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'error' && typeof body.message === 'string') {
      const event: WSEvent = {
        type: 'error',
        data: {
          message: body.message,
          fatal: true
        },
        message: body.message
      }
      applySessionEvent(id, event, {
        broadcast: (ev) => broadcastSessionEvent(id, ev),
        onSessionUpdated
      })
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'exit') {
      const exitCode = Number(body.data?.exitCode ?? body.exitCode ?? 0)
      if (exitCode === 0) {
        updateAndNotifySession(id, { status: 'completed' })
      } else {
        const stderr = body.data?.stderr ?? body.stderr ?? ''
        const latestSession = db.getSession(id)
        if (latestSession?.status !== 'failed') {
          const message = stderr !== ''
            ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
            : `Process exited with code ${exitCode}`
          const event: WSEvent = {
            type: 'error',
            data: {
              message,
              details: stderr !== '' ? { stderr } : undefined,
              fatal: true
            },
            message
          }
          applySessionEvent(id, event, {
            broadcast: (ev) => broadcastSessionEvent(id, ev),
            onSessionUpdated
          })
        }
      }
      ctx.body = { ok: true }
      return
    }

    if (body.type === 'stop') {
      const latestSession = db.getSession(id)
      if (latestSession?.status !== 'failed') {
        updateAndNotifySession(id, { status: 'completed' })
      }
      ctx.body = { ok: true }
      return
    }

    throw badRequest('Invalid event', { type: body.type }, 'invalid_event')
  })

  router.delete('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    db.deleteChannelSessionBySessionId(id)
    const removed = db.deleteSession(id)
    if (removed) {
      // 显式销毁会话进程
      killSession(id)
      notifySessionUpdated(id, { id, isDeleted: true })
    }
    ctx.body = { ok: true, removed }
  })

  router.post('/:id/fork', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { title } = ctx.request.body as { title?: string }

    const original = db.getSession(id)
    if (!original) {
      throw notFound('Original session not found', { id }, 'original_session_not_found')
    }

    // 创建新会话
    const newSession = db.createSession((title != null && title !== '') ? title : `${original.title} (Fork)`)

    // 同步历史消息
    db.copyMessages(id, newSession.id)

    notifySessionUpdated(newSession.id, newSession)

    ctx.body = { session: newSession }
  })

  router.all('/:id', (ctx) => {
    throw methodNotAllowed('Method Not Allowed', { path: ctx.path }, 'method_not_allowed')
  })

  return router
}
