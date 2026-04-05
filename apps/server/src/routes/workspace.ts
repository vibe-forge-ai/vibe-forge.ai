import Router from '@koa/router'

import { listWorkspaceTree } from '#~/services/workspace/tree.js'

export function workspaceRouter(): Router {
  const router = new Router()

  router.get('/tree', async (ctx) => {
    const { path } = ctx.query as { path?: string }
    ctx.body = await listWorkspaceTree(path)
  })

  return router
}
