import Router from '@koa/router'

import { getWorkspaceGitState, listWorkspaceGitBranches, listWorkspaceGitWorktrees } from '#~/services/git/index.js'
import { readWorkspaceFile, updateWorkspaceFile } from '#~/services/workspace/file.js'
import { listWorkspaceTree } from '#~/services/workspace/tree.js'

export function workspaceRouter(): Router {
  const router = new Router()

  router.get('/tree', async (ctx) => {
    const { path } = ctx.query as { path?: string }
    ctx.body = await listWorkspaceTree(path)
  })

  router.get('/file', async (ctx) => {
    const { path } = ctx.query as { path?: string }
    ctx.body = await readWorkspaceFile(path)
  })

  router.put('/file', async (ctx) => {
    const { content, path } = ctx.request.body as { content?: unknown; path?: string }
    ctx.body = await updateWorkspaceFile(path, content)
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
