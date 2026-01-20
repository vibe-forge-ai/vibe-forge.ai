import { getDb } from '#~/db.js'
import { notifySessionUpdated, updateAndNotifySession } from '#~/websocket/index.js'
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

  router.post('/', (ctx) => {
    const { title } = ctx.request.body as { title?: string }
    const session = db.createSession(title)
    notifySessionUpdated(session.id, session)
    ctx.body = { session }
  })
  router.post('', (ctx) => {
    const { title } = ctx.request.body as { title?: string }
    const session = db.createSession(title)
    notifySessionUpdated(session.id, session)
    ctx.body = { session }
  })

  router.delete('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const removed = db.deleteSession(id)
    if (removed) {
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
