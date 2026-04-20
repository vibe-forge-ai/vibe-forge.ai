import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

import type { AdapterAccountInfo, AdapterAccountQuotaMetric, AdapterAccountsResult } from '@vibe-forge/types'

import { getAdapterAccounts } from '#~/api.js'
import { resolveChatAdapterAccountKey } from './account-selection'
import { normalizeNonEmptyString } from './model-selector'

export interface ChatAdapterAccountOption {
  value: string
  label: string
  hint?: string
  meta?: string
}

const ACCOUNT_STORAGE_KEY_PREFIX = 'vf_chat_adapter_account:'

const formatQuotaMetric = (metric: AdapterAccountQuotaMetric) => {
  const label = normalizeNonEmptyString(metric.label) ??
    normalizeNonEmptyString(
      metric.id
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, match => match.toUpperCase())
    )
  const value = normalizeNonEmptyString(metric.value)
  if (label != null && value != null) {
    return `${label}: ${value}`
  }
  return value ?? label
}

const formatQuotaMeta = (quota: AdapterAccountInfo['quota']) => {
  const metrics = (quota?.metrics ?? [])
    .slice()
    .sort((left, right) => Number(right.primary === true) - Number(left.primary === true))
    .map(formatQuotaMetric)
    .filter((value): value is string => value != null && value !== '')

  if (metrics.length > 0) {
    return metrics.slice(0, 2).join(' · ')
  }

  const summary = normalizeNonEmptyString(quota?.summary)
  return summary == null ? undefined : `Quota: ${summary}`
}

const readStoredAccount = (adapter: string | undefined) => {
  const normalizedAdapter = normalizeNonEmptyString(adapter)
  if (normalizedAdapter == null) {
    return undefined
  }

  try {
    const raw = localStorage.getItem(`${ACCOUNT_STORAGE_KEY_PREFIX}${normalizedAdapter}`)
    return raw == null || raw.trim() === '' ? undefined : raw.trim()
  } catch {
    return undefined
  }
}

export function useChatAdapterAccountSelection({
  adapter,
  model
}: {
  adapter?: string
  model?: string
}) {
  const normalizedAdapter = normalizeNonEmptyString(adapter)
  const [selectedAccount, setSelectedAccountState] = useState<string | undefined>(() => readStoredAccount(adapter))

  useEffect(() => {
    setSelectedAccountState(readStoredAccount(normalizedAdapter))
  }, [normalizedAdapter])

  const { data } = useSWR<AdapterAccountsResult>(
    normalizedAdapter == null ? null : ['/api/adapters', normalizedAdapter, model ?? ''],
    normalizedAdapter == null ? null : () => getAdapterAccounts(normalizedAdapter, { model })
  )

  const accountOptions = useMemo<ChatAdapterAccountOption[]>(() => {
    return (data?.accounts ?? [])
      .filter(account => account.status !== 'missing')
      .map(account => ({
        value: account.key,
        label: account.title,
        hint: account.description,
        meta: formatQuotaMeta(account.quota)
      }))
  }, [data?.accounts])

  const resolveSelectableAccount = useCallback((value?: string) => (
    resolveChatAdapterAccountKey({
      value,
      accountOptions,
      defaultAccount: data?.defaultAccount
    })
  ), [accountOptions, data?.defaultAccount])

  const resolvedSelectedAccount = useMemo(
    () => resolveSelectableAccount(selectedAccount),
    [resolveSelectableAccount, selectedAccount]
  )

  useEffect(() => {
    if (normalizedAdapter == null) {
      setSelectedAccountState(undefined)
      return
    }

    if (accountOptions.length === 0 && normalizeNonEmptyString(data?.defaultAccount) == null) {
      return
    }

    const nextValue = resolveSelectableAccount(selectedAccount)
    setSelectedAccountState((prev) => prev === nextValue ? prev : nextValue)
  }, [accountOptions.length, data?.defaultAccount, normalizedAdapter, resolveSelectableAccount, selectedAccount])

  useEffect(() => {
    if (normalizedAdapter == null) {
      return
    }

    try {
      const storageKey = `${ACCOUNT_STORAGE_KEY_PREFIX}${normalizedAdapter}`
      if (resolvedSelectedAccount == null || resolvedSelectedAccount.trim() === '') {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, resolvedSelectedAccount)
      }
    } catch {}
  }, [normalizedAdapter, resolvedSelectedAccount])

  const applySessionSelection = useCallback((params: { account?: string }) => {
    const nextAccount = resolveSelectableAccount(params.account) ?? normalizeNonEmptyString(params.account)
    setSelectedAccountState((prev) => prev === nextAccount ? prev : nextAccount)
  }, [resolveSelectableAccount])

  const updateSelectedAccount = useCallback((value?: string) => {
    const nextAccount = resolveSelectableAccount(value) ?? normalizeNonEmptyString(value)
    setSelectedAccountState((prev) => prev === nextAccount ? prev : nextAccount)
  }, [resolveSelectableAccount])

  return {
    accountOptions,
    selectedAccount: resolvedSelectedAccount,
    setSelectedAccount: updateSelectedAccount,
    applySessionSelection,
    showAccountSelector: normalizedAdapter != null && accountOptions.length > 0
  }
}
