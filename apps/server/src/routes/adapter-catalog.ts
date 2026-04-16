import Router from '@koa/router'

import { loadAdapterCatalog } from '#~/services/config/adapter-catalog.js'
import { internalServerError } from '#~/utils/http.js'

export function adapterCatalogRouter(): Router {
  const router = new Router()

  router.get('/', async (ctx) => {
    try {
      ctx.body = await loadAdapterCatalog()
    } catch (error) {
      throw internalServerError('Failed to load adapter catalog', {
        cause: error,
        code: 'adapter_catalog_load_failed'
      })
    }
  })

  return router
}
