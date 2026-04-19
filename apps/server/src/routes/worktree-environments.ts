import Router from '@koa/router'

import type { WorktreeEnvironmentSavePayload, WorktreeEnvironmentSource } from '@vibe-forge/types'

import {
  deleteWorktreeEnvironment,
  getWorktreeEnvironment,
  listWorktreeEnvironments,
  saveWorktreeEnvironment
} from '#~/services/worktree-environments.js'
import { badRequest, notFound } from '#~/utils/http.js'

const ENVIRONMENT_ID_PATTERN = /^\w[\w.-]{0,127}$/

const assertEnvironmentIdParam = (id: string | undefined) => {
  if (typeof id !== 'string' || id.trim() === '') {
    throw badRequest('Worktree environment id is required', { id }, 'worktree_environment_id_required')
  }
  const normalized = id.trim()
  if (!ENVIRONMENT_ID_PATTERN.test(normalized)) {
    throw badRequest('Invalid worktree environment id', { id }, 'worktree_environment_id_invalid')
  }
  return normalized
}

const getSourceQuery = (value: unknown): WorktreeEnvironmentSource | undefined => {
  if (value === 'project' || value === 'user') {
    return value
  }
  return undefined
}

export function worktreeEnvironmentsRouter(): Router {
  const router = new Router()

  router.get(['/', ''], async (ctx) => {
    ctx.body = await listWorktreeEnvironments()
  })

  router.get('/:id', async (ctx) => {
    const { id } = ctx.params as { id?: string }
    const environmentId = assertEnvironmentIdParam(id)
    const source = getSourceQuery(ctx.query.source)
    try {
      ctx.body = {
        environment: await getWorktreeEnvironment(environmentId, undefined, source)
      }
    } catch (error) {
      throw notFound(
        error instanceof Error ? error.message : 'Worktree environment not found',
        { id },
        'worktree_environment_not_found'
      )
    }
  })

  router.put('/:id', async (ctx) => {
    const { id } = ctx.params as { id?: string }
    const payload = (ctx.request.body ?? {}) as WorktreeEnvironmentSavePayload
    const source = getSourceQuery(ctx.query.source)
    ctx.body = {
      environment: await saveWorktreeEnvironment(assertEnvironmentIdParam(id), payload, undefined, source)
    }
  })

  router.delete('/:id', async (ctx) => {
    const { id } = ctx.params as { id?: string }
    const source = getSourceQuery(ctx.query.source)
    const removed = await deleteWorktreeEnvironment(assertEnvironmentIdParam(id), undefined, source)
    ctx.body = { ok: true, removed }
  })

  return router
}
