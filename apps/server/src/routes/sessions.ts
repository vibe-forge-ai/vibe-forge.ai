import { getDb } from '#~/db.js'
import Router from '@koa/router'

export function sessionsRouter(): Router {
  const router = new Router()
  const db = getDb()

  router.get('/', (ctx) => {
    ctx.body = { sessions: db.getSessions() }
  })
  router.get('', (ctx) => {
    ctx.body = { sessions: db.getSessions() }
  })

  router.patch('/:id', (ctx) => {
    const { id } = ctx.params as { id: string }
    const { title } = ctx.request.body as { title: string }
    if (!title) {
      ctx.status = 400
      ctx.body = { error: 'Title is required' }
      return
    }
    db.updateSessionTitle(id, title)
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
