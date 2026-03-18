import Router from '@koa/router'
import { AskUserQuestionParamsSchema } from '@vibe-forge/core/schema'

import { requestInteraction } from '#~/services/session/interaction.js'
import { badRequest, notFound, requestTimeout } from '#~/utils/http.js'

export function interactRouter() {
  const router = new Router()

  router.post('/ask', async (ctx) => {
    const body = ctx.request.body
    const result = AskUserQuestionParamsSchema.safeParse(body)

    if (!result.success) {
      throw badRequest('Invalid parameters', result.error.errors, 'invalid_parameters')
    }

    try {
      const answer = await requestInteraction(result.data)
      ctx.body = { result: answer }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not active')) {
        throw notFound(err.message, undefined, 'interaction_not_active')
      }
      throw requestTimeout(err instanceof Error ? err.message : String(err), undefined, 'interaction_timeout')
    }
  })

  return router
}
