import Router from '@koa/router'
import { AskUserQuestionParamsSchema } from '@vibe-forge/core/schema'
import { requestInteraction } from '#~/websocket/index.js'

export function interactRouter() {
  const router = new Router()

  router.post('/ask', async (ctx) => {
    const body = ctx.request.body
    const result = AskUserQuestionParamsSchema.safeParse(body)

    if (!result.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid parameters', details: result.error.errors }
      return
    }

    try {
      const answer = await requestInteraction(result.data)
      ctx.body = { result: answer }
    } catch (err) {
      ctx.status = err instanceof Error && err.message.includes('not active') ? 404 : 408
      ctx.body = { error: err instanceof Error ? err.message : String(err) }
    }
  })

  return router
}
