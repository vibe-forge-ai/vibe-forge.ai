import Router from '@koa/router'

import { installSkillHubPlugin, searchSkillHub } from '#~/services/skill-hub/index.js'
import { badRequest, internalServerError } from '#~/utils/http.js'

const normalizeString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

export function skillHubRouter(): Router {
  const router = new Router()

  router.get('/search', async (ctx) => {
    try {
      ctx.body = await searchSkillHub({
        query: typeof ctx.query.q === 'string' ? ctx.query.q : '',
        registry: typeof ctx.query.registry === 'string' ? ctx.query.registry : undefined
      })
    } catch (err) {
      throw internalServerError('Failed to search skill hub', { cause: err, code: 'skill_hub_search_failed' })
    }
  })

  router.post('/install', async (ctx) => {
    const body = ctx.request.body as {
      registry?: unknown
      plugin?: unknown
      force?: unknown
      scope?: unknown
    }
    const registry = normalizeString(body.registry)
    const plugin = normalizeString(body.plugin)

    if (registry == null || plugin == null) {
      throw badRequest('Missing registry or plugin', { registry: body.registry, plugin: body.plugin }, 'missing_target')
    }

    try {
      ctx.body = await installSkillHubPlugin({
        registry,
        plugin,
        force: body.force === true,
        scope: normalizeString(body.scope)
      })
    } catch (err) {
      throw internalServerError('Failed to install skill hub plugin', {
        cause: err,
        code: 'skill_hub_install_failed',
        details: {
          registry,
          plugin,
          message: err instanceof Error ? err.message : String(err)
        }
      })
    }
  })

  return router
}
