import process from 'node:process'

import Router from '@koa/router'

import type { AdapterCtx, AdapterManageAccountOptions } from '@vibe-forge/types'
import { loadAdapter } from '@vibe-forge/types'
import { persistAdapterAccountArtifacts, removeStoredAdapterAccount } from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'

import { loadConfigState } from '#~/services/config/index.js'
import { badRequest, internalServerError, isHttpError } from '#~/utils/http.js'

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

const normalizeAdapterKey = (value: unknown) => (
  typeof value === 'string' ? value.trim() : ''
)

const createAdapterRouteContext = async (adapterKey: string) => {
  const { workspaceFolder, projectConfig, userConfig } = await loadConfigState()
  const adapter = await loadAdapter(adapterKey)
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

  return {
    workspaceFolder,
    adapter,
    adapterCtx
  }
}

export function adaptersRouter(): Router {
  const router = new Router()

  router.get('/:adapter/accounts', async (ctx) => {
    const adapterKey = normalizeAdapterKey(ctx.params.adapter)
    if (adapterKey === '') {
      throw badRequest('Invalid adapter', { adapter: ctx.params.adapter }, 'invalid_adapter')
    }

    try {
      const { adapter, adapterCtx } = await createAdapterRouteContext(adapterKey)
      if (adapter.getAccounts == null) {
        ctx.body = {
          accounts: []
        }
        return
      }

      const model = typeof ctx.query.model === 'string' ? ctx.query.model : undefined
      const account = typeof ctx.query.account === 'string' ? ctx.query.account : undefined
      const refresh = ctx.query.refresh === '1' || ctx.query.refresh === 'true'

      ctx.body = await adapter.getAccounts(adapterCtx, {
        model,
        account,
        refresh
      })
    } catch (error) {
      if (isHttpError(error)) {
        throw error
      }
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

  router.get('/:adapter/accounts/:account', async (ctx) => {
    const adapterKey = normalizeAdapterKey(ctx.params.adapter)
    const accountKey = normalizeAdapterKey(ctx.params.account)
    if (adapterKey === '') {
      throw badRequest('Invalid adapter', { adapter: ctx.params.adapter }, 'invalid_adapter')
    }
    if (accountKey === '') {
      throw badRequest('Invalid account', { account: ctx.params.account }, 'invalid_account')
    }

    try {
      const { adapter, adapterCtx } = await createAdapterRouteContext(adapterKey)
      if (adapter.getAccountDetail == null) {
        throw badRequest(`Adapter "${adapterKey}" does not support account detail.`, undefined, 'adapter_account_detail_unsupported')
      }

      const model = typeof ctx.query.model === 'string' ? ctx.query.model : undefined
      const refresh = ctx.query.refresh === '1' || ctx.query.refresh === 'true'

      ctx.body = await adapter.getAccountDetail(adapterCtx, {
        account: accountKey,
        model,
        refresh
      })
    } catch (error) {
      if (isHttpError(error)) {
        throw error
      }
      throw internalServerError(
        'Failed to load adapter account detail',
        {
          adapter: adapterKey,
          account: accountKey,
          cause: error,
          code: 'adapter_account_detail_load_failed'
        }
      )
    }
  })

  router.post('/:adapter/accounts/actions', async (ctx) => {
    const adapterKey = normalizeAdapterKey(ctx.params.adapter)
    if (adapterKey === '') {
      throw badRequest('Invalid adapter', { adapter: ctx.params.adapter }, 'invalid_adapter')
    }

    const body = (ctx.request.body ?? {}) as {
      action?: unknown
      account?: unknown
      model?: unknown
      refresh?: unknown
    }
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const account = typeof body.account === 'string' ? body.account.trim() : undefined
    const model = typeof body.model === 'string' ? body.model.trim() : undefined
    const refresh = body.refresh === true || body.refresh === 'true' || body.refresh === 1 || body.refresh === '1'

    if (action !== 'add' && action !== 'refresh' && action !== 'remove') {
      throw badRequest('Invalid account action', { action: body.action }, 'invalid_adapter_account_action')
    }

    const abortController = new AbortController()
    const abortOnRequestClose = () => {
      if (!abortController.signal.aborted) {
        abortController.abort(new Error('Adapter account request aborted by client.'))
      }
    }
    ctx.req.once('aborted', abortOnRequestClose)
    ctx.req.once('close', abortOnRequestClose)

    try {
      const { workspaceFolder, adapter, adapterCtx } = await createAdapterRouteContext(adapterKey)
      if (adapter.manageAccount == null) {
        throw badRequest(`Adapter "${adapterKey}" does not support account management.`, undefined, 'adapter_account_manage_unsupported')
      }

      const result = await adapter.manageAccount(adapterCtx, {
        action: action as AdapterManageAccountOptions['action'],
        account,
        model,
        refresh,
        signal: abortController.signal
      })

      if ((result.artifacts?.length ?? 0) > 0) {
        if (result.accountKey == null || result.accountKey.trim() === '') {
          throw badRequest(
            'Adapter account action returned artifacts without an account key.',
            { adapter: adapterKey, action },
            'adapter_account_missing_storage_key'
          )
        }

        await persistAdapterAccountArtifacts({
          cwd: workspaceFolder,
          env: adapterCtx.env,
          adapter: adapterKey,
          account: result.accountKey,
          artifacts: result.artifacts
        })
      }

      if (result.removeStoredAccount === true) {
        if (result.accountKey == null || result.accountKey.trim() === '') {
          throw badRequest(
            'Adapter account remove action requires an account key.',
            { adapter: adapterKey, action },
            'adapter_account_missing_remove_key'
          )
        }

        await removeStoredAdapterAccount({
          cwd: workspaceFolder,
          env: adapterCtx.env,
          adapter: adapterKey,
          account: result.accountKey
        })
      }

      const detail = result.accountKey != null && result.accountKey.trim() !== '' && adapter.getAccountDetail != null
        ? await adapter.getAccountDetail(adapterCtx, {
          account: result.accountKey,
          model,
          refresh: true
        }).catch(() => undefined)
        : undefined
      const { artifacts: _artifacts, ...publicResult } = result

      ctx.body = {
        ...publicResult,
        ...(detail != null ? { account: detail.account } : {})
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }
      if (isHttpError(error)) {
        throw error
      }
      throw internalServerError(
        'Failed to run adapter account action',
        {
          adapter: adapterKey,
          cause: error,
          code: 'adapter_account_action_failed'
        }
      )
    } finally {
      ctx.req.off('aborted', abortOnRequestClose)
      ctx.req.off('close', abortOnRequestClose)
    }
  })

  return router
}
