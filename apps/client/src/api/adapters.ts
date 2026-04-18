import type { AdapterAccountsResult } from '@vibe-forge/types'

import { createApiUrl, fetchApiJson } from './base'

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
