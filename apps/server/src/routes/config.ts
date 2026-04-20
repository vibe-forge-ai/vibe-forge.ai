import Router from '@koa/router'

import {
  generateWorkspaceConfigSchema,
  loadConfigResponse,
  loadConfigSchemaResponse,
  updateConfigSectionAndReload
} from '#~/services/config/api.js'
import { badRequest, internalServerError, isHttpError } from '#~/utils/http.js'

export function configRouter(): Router {
  const router = new Router()

  router.get('/schema', async (ctx) => {
    try {
      ctx.body = await loadConfigSchemaResponse()
    } catch (err) {
      throw internalServerError('Failed to load config schema', { cause: err, code: 'config_schema_load_failed' })
    }
  })

  router.post('/schema/generate', async (ctx) => {
    try {
      ctx.body = await generateWorkspaceConfigSchema()
    } catch (err) {
      throw internalServerError('Failed to generate config schema', {
        cause: err,
        code: 'config_schema_generate_failed'
      })
    }
  })

  router.get('/', async (ctx) => {
    try {
      ctx.body = await loadConfigResponse()
    } catch (err) {
      throw internalServerError('Failed to load config', { cause: err, code: 'config_load_failed' })
    }
  })

  router.patch('/', async (ctx) => {
    const { source, section, value } = ctx.request.body as {
      source?: 'project' | 'user'
      section?: string
      value?: unknown
    }

    if (source !== 'project' && source !== 'user') {
      throw badRequest('Invalid source', { source }, 'invalid_source')
    }

    if (section == null || typeof section !== 'string' || section.trim() === '') {
      throw badRequest('Invalid section', { section }, 'invalid_section')
    }

    try {
      ctx.body = await updateConfigSectionAndReload({
        section,
        source,
        value
      })
    } catch (err) {
      if (isHttpError(err)) {
        throw err
      }
      throw internalServerError('Failed to update config', { cause: err, code: 'config_update_failed' })
    }
  })

  return router
}
