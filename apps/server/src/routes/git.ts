import Router from '@koa/router'

import type { GitBranchKind, GitCommitPayload, GitPushPayload } from '@vibe-forge/types'

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
    const body = ctx.request.body as GitCommitPayload

    if (body.message != null && typeof body.message !== 'string') {
      throw badRequest('Commit message is invalid', undefined, 'git_commit_invalid_payload')
    }

    if (body.includeUnstagedChanges != null && typeof body.includeUnstagedChanges !== 'boolean') {
      throw badRequest('Commit options are invalid', undefined, 'git_commit_invalid_payload')
    }

    if (body.amend != null && typeof body.amend !== 'boolean') {
      throw badRequest('Commit options are invalid', undefined, 'git_commit_invalid_payload')
    }

    if (body.skipHooks != null && typeof body.skipHooks !== 'boolean') {
      throw badRequest('Commit options are invalid', undefined, 'git_commit_invalid_payload')
    }

    ctx.body = {
      repo: await commitSessionGitChanges(sessionId, body)
    }
  })

  router.post('/push', async (ctx) => {
    const { sessionId } = ctx.params as { sessionId: string }
    const body = (ctx.request.body ?? {}) as GitPushPayload

    if (body.force != null && typeof body.force !== 'boolean') {
      throw badRequest('Push options are invalid', undefined, 'git_push_invalid_payload')
    }

    ctx.body = {
      repo: await pushSessionGitBranch(sessionId, body)
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
