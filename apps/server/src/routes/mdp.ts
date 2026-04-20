import Router from '@koa/router'

import { collectMdpSummary, type MdpBridgeRequest } from '@vibe-forge/mdp'

import { loadConfigState } from '#~/services/config/index.js'
import { executeLocalMdpBridgeRequest } from '#~/services/mdp/root-server.js'
import { badRequest, internalServerError } from '#~/utils/http.js'

export function mdpRouter(): Router {
  const router = new Router()

  router.get('/summary', async (ctx) => {
    try {
      const { workspaceFolder, mergedConfig } = await loadConfigState()
      ctx.body = await collectMdpSummary({
        cwd: workspaceFolder,
        config: mergedConfig
      })
    } catch (error) {
      throw internalServerError('Failed to query MDP topology', {
        cause: error,
        code: 'mdp_query_failed'
      })
    }
  })

  router.get('/clients', async (ctx) => {
    try {
      const { workspaceFolder, mergedConfig } = await loadConfigState()
      const summary = await collectMdpSummary({
        cwd: workspaceFolder,
        config: mergedConfig
      })
      ctx.body = {
        enabled: summary.enabled,
        connections: summary.connections,
        hidden: summary.hidden,
        clients: summary.clients
      }
    } catch (error) {
      throw internalServerError('Failed to query MDP clients', {
        cause: error,
        code: 'mdp_clients_query_failed'
      })
    }
  })

  router.get('/paths', async (ctx) => {
    try {
      const { workspaceFolder, mergedConfig } = await loadConfigState()
      const summary = await collectMdpSummary({
        cwd: workspaceFolder,
        config: mergedConfig
      })
      ctx.body = {
        enabled: summary.enabled,
        connections: summary.connections,
        hidden: summary.hidden,
        paths: summary.paths
      }
    } catch (error) {
      throw internalServerError('Failed to query MDP paths', {
        cause: error,
        code: 'mdp_paths_query_failed'
      })
    }
  })

  router.post('/bridge', async (ctx) => {
    const body = ctx.request.body as {
      targetUrl?: string
      request?: MdpBridgeRequest
    }

    if (typeof body?.targetUrl !== 'string' || body.targetUrl.trim() === '') {
      throw badRequest('Missing MDP target URL', undefined, 'mdp_bridge_missing_target_url')
    }

    if (body.request == null || typeof body.request !== 'object') {
      throw badRequest('Missing MDP bridge request', undefined, 'mdp_bridge_missing_request')
    }

    try {
      ctx.body = await executeLocalMdpBridgeRequest(body.targetUrl, body.request)
    } catch (error) {
      throw internalServerError('Failed to execute local MDP bridge request', {
        cause: error,
        code: 'mdp_bridge_request_failed'
      })
    }
  })

  return router
}
