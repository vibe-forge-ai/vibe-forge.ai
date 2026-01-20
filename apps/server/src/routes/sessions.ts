import { getDb } from '#~/db.js'
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

    if (title !== undefined) {
      db.updateSessionTitle(id, title)
    }
    if (isStarred !== undefined) {
      db.updateSessionStarred(id, isStarred)
    }
    if (isArchived !== undefined) {
      db.updateSessionArchived(id, isArchived)
    }
    if (tags !== undefined) {
      db.updateSessionTags(id, tags)
    }

    ctx.body = { ok: true }
  })

  router.post('/', (ctx) => {
    const { title } = ctx.request.body as { title?: string }
    const session = db.createSession(title)
    ctx.body = { session }
  })
  router.post('', (ctx) => {
    const { title } = ctx.request.body as { title?: string }
    const session = db.createSession(title)
    ctx.body = { session }
  })

  router.delete('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const removed = db.deleteSession(id)
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

    ctx.body = { session: newSession }
  })

  router.all('/:id', (ctx) => {
    ctx.status = 405
    ctx.body = { error: 'Method Not Allowed' }
  })

  return router
}
