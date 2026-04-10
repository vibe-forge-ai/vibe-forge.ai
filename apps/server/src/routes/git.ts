import Router from '@koa/router'

import type { GitBranchKind } from '@vibe-forge/types'

import {
  checkoutSessionGitBranch,
  commitSessionGitChanges,
  createSessionGitBranch,
  getSessionGitState,
  listSessionGitBranches,
  pushSessionGitBranch,
  syncSessionGitBranch
} from '#~/services/git/index.js'
import { badRequest } from '#~/utils/http.js'

export function gitRouter(): Router {
  const router = new Router()

  router.get('/', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    ctx.body = await getSessionGitState(sessionId)
  })

  router.get('/branches', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    ctx.body = await listSessionGitBranches(sessionId)
  })

  router.post('/checkout', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    const { name, kind } = ctx.request.body as {
      name?: string
      kind?: GitBranchKind
    }

    if ((kind !== 'local' && kind !== 'remote') || typeof name !== 'string' || name.trim() === '') {
      throw badRequest('Invalid git checkout request', { name, kind }, 'git_checkout_invalid_payload')
    }

    ctx.body = {
      repo: await checkoutSessionGitBranch(sessionId, { name: name.trim(), kind })
    }
  })

  router.post('/branches', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    const { name } = ctx.request.body as { name?: string }

    if (typeof name !== 'string' || name.trim() === '') {
      throw badRequest('Branch name is required', { name }, 'git_branch_name_required')
    }

    ctx.body = {
      repo: await createSessionGitBranch(sessionId, name)
    }
  })

  router.post('/commit', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    const { message } = ctx.request.body as { message?: string }

    if (typeof message !== 'string' || message.trim() === '') {
      throw badRequest('Commit message is required', undefined, 'git_commit_message_required')
    }

    ctx.body = {
      repo: await commitSessionGitChanges(sessionId, message)
    }
  })

  router.post('/push', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    ctx.body = {
      repo: await pushSessionGitBranch(sessionId)
    }
  })

  router.post('/sync', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    ctx.body = {
      repo: await syncSessionGitBranch(sessionId)
    }
  })

  return router
}
