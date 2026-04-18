import Router from '@koa/router'

import type { ChatMessage, ChatMessageContent, SessionQueuedMessageMode, WSEvent } from '@vibe-forge/core'
import type { GitBranchKind, SessionInfo, SessionInitInfo, SessionPromptType } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { branchSessionFromMessage } from '#~/services/session/history.js'
import { killSession, processUserMessage, updateAndNotifySession } from '#~/services/session/index.js'
import {
  getSessionInteraction,
  handleInteractionResponse,
  setSessionInteraction
} from '#~/services/session/interaction.js'
import {
  createSessionQueuedMessage,
  deleteSessionQueuedMessage,
  listSessionQueuedMessages,
  moveSessionQueuedMessage,
  reorderSessionQueuedMessages,
  updateSessionQueuedMessage
} from '#~/services/session/queue.js'
import { broadcastSessionEvent, notifySessionUpdated } from '#~/services/session/runtime.js'
import {
  createSessionManagedWorktree,
  deleteSessionWorkspace,
  provisionSessionWorkspace,
  resolveSessionWorkspace,
  resolveSessionWorkspaceFolder,
  transferSessionWorkspaceToLocal
} from '#~/services/session/workspace.js'
import { disposeTerminalSession } from '#~/services/terminal/index.js'
import { listWorkspaceTree } from '#~/services/workspace/tree.js'
import { badRequest, conflict, methodNotAllowed, notFound } from '#~/utils/http.js'

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
    ctx.body = {
      messages: responseMessages,
      session,
      interaction,
      queuedMessages: listSessionQueuedMessages(id)
    }
  })

  router.get('/:id/workspace', async (ctx) => {
    const { id } = ctx.params as { id: string }
    ctx.body = {
      workspace: await resolveSessionWorkspace(id)
    }
  })

  router.get('/:id/workspace/tree', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const { path } = ctx.query as { path?: string }
    const workspaceFolder = await resolveSessionWorkspaceFolder(id)
    ctx.body = await listWorkspaceTree(path, { workspaceFolder })
  })

  router.post('/:id/workspace/create-worktree', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const workspace = await createSessionManagedWorktree(id)
    killSession(id)
    disposeTerminalSession(id)
    ctx.body = { workspace }
  })

  router.post('/:id/workspace/transfer-local', async (ctx) => {
    const { id } = ctx.params as { id: string }
    ctx.body = {
      workspace: await transferSessionWorkspaceToLocal(id)
    }
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
      adapter,
      workspace
    } = ctx.request.body as {
      id?: string
      title?: string
      initialMessage?: string
      initialContent?: ChatMessageContent[]
      parentSessionId?: string
      start?: boolean
      model?: string
      effort?: 'low' | 'medium' | 'high' | 'max'
      promptType?: SessionPromptType
      promptName?: string
      permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
      adapter?: string
      workspace?: {
        createWorktree?: boolean
        branch?: {
          name?: string
          kind?: GitBranchKind
          mode?: 'checkout' | 'create'
        }
      }
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
      adapter,
      workspace: workspace == null
        ? undefined
        : {
          createWorktree: workspace.createWorktree,
          branch: workspace.branch?.name?.trim()
            ? {
              name: workspace.branch.name.trim(),
              kind: workspace.branch.kind,
              mode: workspace.branch.mode
            }
            : undefined
        }
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
      const handled = handleInteractionResponse(id, body.id, body.data)
      if (!handled) {
        throw conflict(
          'Interaction response is no longer pending',
          { id: body.id },
          'interaction_not_pending'
        )
      }
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

  router.delete('/:id', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const { force } = ctx.query as { force?: string }

    // 显式销毁会话进程，避免 worktree 删除时仍被占用
    killSession(id)
    disposeTerminalSession(id)

    await deleteSessionWorkspace(id, {
      force: force === 'true'
    })

    db.deleteChannelSessionBySessionId(id)
    const removed = db.deleteSession(id)
    if (removed) {
      notifySessionUpdated(id, { id, isDeleted: true })
    }
    ctx.body = { ok: true, removed }
  })

  router.post('/:id/queued-messages', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { mode, content } = ctx.request.body as {
      mode?: SessionQueuedMessageMode
      content?: ChatMessageContent[]
    }

    if (mode !== 'steer' && mode !== 'next') {
      throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
    }
    if (!Array.isArray(content) || content.length === 0) {
      throw badRequest('Queued message content cannot be empty', undefined, 'empty_queued_message_content')
    }

    const session = db.getSession(id)
    if (session == null) {
      throw notFound('Session not found', { id }, 'session_not_found')
    }

    const queuedMessage = createSessionQueuedMessage(id, mode, content)
    ctx.body = { queuedMessage, queuedMessages: listSessionQueuedMessages(id) }
  })

  router.patch('/:id/queued-messages/:queueId', (ctx) => {
    const { id, queueId } = ctx.params as { id: string; queueId: string }
    const { content } = ctx.request.body as { content?: ChatMessageContent[] }

    if (!Array.isArray(content) || content.length === 0) {
      throw badRequest('Queued message content cannot be empty', undefined, 'empty_queued_message_content')
    }

    const updated = updateSessionQueuedMessage(id, queueId, content)
    if (updated == null) {
      throw notFound('Queued message not found', { id, queueId }, 'queued_message_not_found')
    }

    ctx.body = { queuedMessage: updated, queuedMessages: listSessionQueuedMessages(id) }
  })

  router.delete('/:id/queued-messages/:queueId', (ctx) => {
    const { id, queueId } = ctx.params as { id: string; queueId: string }
    const removed = deleteSessionQueuedMessage(id, queueId)
    if (!removed) {
      throw notFound('Queued message not found', { id, queueId }, 'queued_message_not_found')
    }
    ctx.body = { ok: true, queuedMessages: listSessionQueuedMessages(id) }
  })

  router.post('/:id/queued-messages/:queueId/move', (ctx) => {
    const { id, queueId } = ctx.params as { id: string; queueId: string }
    const { mode } = ctx.request.body as {
      mode?: SessionQueuedMessageMode
    }

    if (mode !== 'steer' && mode !== 'next') {
      throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
    }

    const moved = moveSessionQueuedMessage(id, queueId, mode)
    if (moved == null) {
      throw notFound('Queued message not found', { id, queueId }, 'queued_message_not_found')
    }

    ctx.body = { queuedMessage: moved, queuedMessages: listSessionQueuedMessages(id) }
  })

  router.post('/:id/queued-messages/reorder', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { mode, ids } = ctx.request.body as {
      mode?: SessionQueuedMessageMode
      ids?: string[]
    }

    if (mode !== 'steer' && mode !== 'next') {
      throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
    }
    if (!Array.isArray(ids) || ids.some(item => typeof item !== 'string' || item.trim() === '')) {
      throw badRequest('Invalid queued message order', { ids }, 'invalid_queued_message_order')
    }

    try {
      reorderSessionQueuedMessages(id, mode, ids)
    } catch (error) {
      throw badRequest('Invalid queued message order', { ids }, 'invalid_queued_message_order')
    }

    ctx.body = { queuedMessages: listSessionQueuedMessages(id) }
  })

  router.post('/:id/messages/:messageId/branch', async (ctx) => {
    const { id, messageId } = ctx.params as { id: string; messageId: string }
    const { action, content, title } = ctx.request.body as {
      action?: 'fork' | 'recall' | 'edit'
      content?: string | ChatMessageContent[]
      title?: string
    }

    if (action !== 'fork' && action !== 'recall' && action !== 'edit') {
      throw badRequest('Invalid message action', { action }, 'invalid_message_action')
    }

    const branchResult = await branchSessionFromMessage({
      sessionId: id,
      messageId,
      action,
      content,
      title
    })

    if (branchResult.replayContent != null) {
      void processUserMessage(branchResult.session.id, branchResult.replayContent).catch((error) => {
        console.error('[sessions] failed to continue branched session:', error)
      })
    }

    ctx.body = { session: db.getSession(branchResult.session.id) ?? branchResult.session }
  })

  router.post('/:id/fork', async (ctx) => {
    const { id } = ctx.params as { id: string }
    const { title } = ctx.request.body as { title?: string }

    const original = db.getSession(id)
    if (!original) {
      throw notFound('Original session not found', { id }, 'original_session_not_found')
    }

    // 创建新会话
    const newSession = db.createSession((title != null && title !== '') ? title : `${original.title} (Fork)`)

    try {
      await provisionSessionWorkspace(newSession.id, {
        sourceSessionId: original.id
      })

      // 同步历史消息
      db.copyMessages(id, newSession.id)
    } catch (error) {
      await deleteSessionWorkspace(newSession.id, { force: true }).catch(() => undefined)
      db.deleteSession(newSession.id)
      throw error
    }

    notifySessionUpdated(newSession.id, newSession)

    ctx.body = { session: newSession }
  })

  router.all('/:id', (ctx) => {
    throw methodNotAllowed('Method Not Allowed', { path: ctx.path }, 'method_not_allowed')
  })

  return router
}
