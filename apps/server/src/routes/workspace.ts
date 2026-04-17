import Router from '@koa/router'

import { getWorkspaceGitState, listWorkspaceGitBranches, listWorkspaceGitWorktrees } from '#~/services/git/index.js'
import { listWorkspaceTree } from '#~/services/workspace/tree.js'

export function workspaceRouter(): Router {
  const router = new Router()

  router.get('/tree', async (ctx) => {
    const { path } = ctx.query as { path?: string }
    ctx.body = await listWorkspaceTree(path)
  })

  router.get('/git', async (ctx) => {
    ctx.body = await getWorkspaceGitState()
  })

  router.get('/git/branches', async (ctx) => {
    ctx.body = await listWorkspaceGitBranches()
  })

  router.get('/git/worktrees', async (ctx) => {
    ctx.body = await listWorkspaceGitWorktrees()
  })

  return router
}
