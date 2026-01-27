import { getDb } from '#~/db.js'
import { notifySessionUpdated, processUserMessage, startAdapterSession, updateAndNotifySession, killSession, getSessionInteraction } from '#~/websocket/index.js'
import Router from '@koa/router'

export function sessionsRouter(): Router {
  const router = new Router()
  const db = getDb()

  router.get('/', (ctx) => {
    ctx.body = { sessions: db.getSessions('active') }
  })
  router.get('', (ctx) => {
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

    if (limit != null) {
      const n = Number.parseInt(limit, 10)
      if (!Number.isNaN(n)) {
        ctx.body = { messages: messages.slice(-n), session, interaction }
        return
      }
    }

    ctx.body = { messages, session, interaction }
  })

  router.patch('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { title, isStarred, isArchived, tags } = ctx.request.body as {
      title?: string
      isStarred?: boolean
      isArchived?: boolean
      tags?: string[]
    }

    if (title !== undefined || isStarred !== undefined || isArchived !== undefined) {
      updateAndNotifySession(id, { title, isStarred, isArchived })
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

  router.post('/', async (ctx) => {
    const { title, initialMessage } = ctx.request.body as { title?: string; initialMessage?: string }
    const session = db.createSession(title)
    notifySessionUpdated(session.id, session)

    if (initialMessage) {
      // 启动进程并发送消息
      try {
        await startAdapterSession(session.id)
        processUserMessage(session.id, initialMessage)
        
        // 获取更新后的会话状态
        const updated = db.getSession(session.id)
        if (updated) {
          Object.assign(session, updated)
        }
      } catch (err) {
        console.error(`[sessions] Failed to start session ${session.id}:`, err)
      }
    }

    ctx.body = { session }
  })
  router.post('', async (ctx) => {
    const { title, initialMessage } = ctx.request.body as { title?: string; initialMessage?: string }
    const session = db.createSession(title)
    notifySessionUpdated(session.id, session)

    if (initialMessage) {
      // 启动进程并发送消息
      try {
        await startAdapterSession(session.id)
        processUserMessage(session.id, initialMessage)
        
        // 获取更新后的会话状态
        const updated = db.getSession(session.id)
        if (updated) {
          Object.assign(session, updated)
        }
      } catch (err) {
        console.error(`[sessions] Failed to start session ${session.id}:`, err)
      }
    }

    ctx.body = { session }
  })

  router.delete('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
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
      ctx.status = 404
      ctx.body = { error: 'Original session not found' }
      return
    }

    // 创建新会话
    const newSession = db.createSession((title != null && title !== '') ? title : `${original.title} (Fork)`)

    // 同步历史消息
    db.copyMessages(id, newSession.id)

    notifySessionUpdated(newSession.id, newSession)

    ctx.body = { session: newSession }
  })

  router.all('/:id', (ctx) => {
    ctx.status = 405
    ctx.body = { error: 'Method Not Allowed' }
  })

  return router
}
