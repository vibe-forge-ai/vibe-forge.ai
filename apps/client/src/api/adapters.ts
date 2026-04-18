import type {
  AdapterAccountDetailResult,
  AdapterAccountsResult,
  AdapterManageAccountOptions,
  AdapterManageAccountResult
} from '@vibe-forge/types'

import { createApiUrl, fetchApiJson, jsonHeaders } from './base'

export async function getAdapterAccounts(
  adapter: string,
  options: {
    model?: string
    account?: string
    refresh?: boolean
  } = {}
): Promise<AdapterAccountsResult> {
  const url = createApiUrl(`/api/adapters/${encodeURIComponent(adapter)}/accounts`)
  if (options.model != null && options.model.trim() !== '') {
    url.searchParams.set('model', options.model)
  }
  if (options.account != null && options.account.trim() !== '') {
    url.searchParams.set('account', options.account)
  }
  if (options.refresh === true) {
    url.searchParams.set('refresh', 'true')
  }
  return fetchApiJson<AdapterAccountsResult>(url)
}

export async function getAdapterAccountDetail(
  adapter: string,
  account: string,
  options: {
    model?: string
    refresh?: boolean
  } = {}
): Promise<AdapterAccountDetailResult> {
  const url = createApiUrl(`/api/adapters/${encodeURIComponent(adapter)}/accounts/${encodeURIComponent(account)}`)
  if (options.model != null && options.model.trim() !== '') {
    url.searchParams.set('model', options.model)
  }
  if (options.refresh === true) {
    url.searchParams.set('refresh', 'true')
  }
  return fetchApiJson<AdapterAccountDetailResult>(url)
}

export async function manageAdapterAccount(
  adapter: string,
  options: Pick<AdapterManageAccountOptions, 'action' | 'account' | 'model' | 'refresh'>
): Promise<AdapterManageAccountResult> {
  return fetchApiJson<AdapterManageAccountResult>(
    createApiUrl(`/api/adapters/${encodeURIComponent(adapter)}/accounts/actions`),
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(options)
    }
  )
}
