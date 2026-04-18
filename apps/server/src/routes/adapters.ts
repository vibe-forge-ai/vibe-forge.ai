import process from 'node:process'

import Router from '@koa/router'

import type { AdapterCtx } from '@vibe-forge/types'
import { loadAdapter } from '@vibe-forge/types'
import { createLogger } from '@vibe-forge/utils/create-logger'

import { loadConfigState } from '#~/services/config/index.js'
import { badRequest, internalServerError } from '#~/utils/http.js'

const createTransientCache = (): AdapterCtx['cache'] => {
  const store = new Map<string, unknown>()

  return {
    set: async (key, value) => {
      store.set(String(key), value)
      return { cachePath: '' }
    },
    get: async (key) => store.get(String(key)) as any
  }
}

export function adaptersRouter(): Router {
  const router = new Router()

  router.get('/:adapter/accounts', async (ctx) => {
    const adapterKey = typeof ctx.params.adapter === 'string'
      ? ctx.params.adapter.trim()
      : ''
    if (adapterKey === '') {
      throw badRequest('Invalid adapter', { adapter: ctx.params.adapter }, 'invalid_adapter')
    }

    try {
      const { workspaceFolder, projectConfig, userConfig } = await loadConfigState()
      const adapter = await loadAdapter(adapterKey)
      if (adapter.getAccounts == null) {
        ctx.body = {
          accounts: []
        }
        return
      }

      const adapterCtx = {
        ctxId: `server-adapter-accounts-${adapterKey}`,
        cwd: workspaceFolder,
        env: {
          ...process.env
        },
        cache: createTransientCache(),
        logger: createLogger(workspaceFolder, `server/adapter-accounts/${adapterKey}`, 'server'),
        configs: [projectConfig, userConfig]
      } satisfies AdapterCtx

      const model = typeof ctx.query.model === 'string' ? ctx.query.model : undefined
      const account = typeof ctx.query.account === 'string' ? ctx.query.account : undefined
      const refresh = ctx.query.refresh === '1' || ctx.query.refresh === 'true'

      ctx.body = await adapter.getAccounts(adapterCtx, {
        model,
        account,
        refresh
      })
    } catch (error) {
      throw internalServerError(
        'Failed to load adapter accounts',
        {
          adapter: adapterKey,
          cause: error,
          code: 'adapter_accounts_load_failed'
        }
      )
    }
  })

  return router
}
