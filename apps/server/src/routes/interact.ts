import Router from '@koa/router'
import { z } from 'zod'
import { AskUserQuestionParamsSchema } from '@vibe-forge/core/schema'

import { requestInteraction } from '#~/services/session/interaction.js'
import {
  resolvePermissionDecision,
  resolvePermissionSubjectFromInput
} from '#~/services/session/permission.js'
import { badRequest, notFound, requestTimeout } from '#~/utils/http.js'

const PermissionCheckSchema = z.object({
  sessionId: z.string(),
  adapter: z.string().optional(),
  toolName: z.string().optional(),
  mcpServer: z.string().optional(),
  toolInput: z.unknown().optional()
})

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

  router.post('/permission-check', async (ctx) => {
    const body = PermissionCheckSchema.safeParse(ctx.request.body)

    if (!body.success) {
      throw badRequest('Invalid parameters', body.error.errors, 'invalid_parameters')
    }

    const subject = resolvePermissionSubjectFromInput({
      toolName: body.data.toolName,
      mcpServer: body.data.mcpServer
    })
    const result = await resolvePermissionDecision({
      sessionId: body.data.sessionId,
      subject
    })

    ctx.body = {
      result: result.result,
      source: result.source,
      subject
    }
  })

  return router
}
