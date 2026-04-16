import { createElement, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import useSWR from 'swr'

import { getConfig } from '#~/api.js'
import { useAdapterCatalog } from '#~/hooks/use-adapter-catalog'
import type { ConfigResponse } from '@vibe-forge/types'

const ADAPTER_STORAGE_KEY = 'vf_chat_adapter'

export function useChatAdapter() {
  const [selectedAdapter, setSelectedAdapter] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem(ADAPTER_STORAGE_KEY)
      return raw == null || raw.trim() === '' ? undefined : raw
    } catch {
      return undefined
    }
  })

  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const { adapterCatalog, getAdapterDisplay } = useAdapterCatalog()

  const mergedAdapters = useMemo(() => {
    return configRes?.sources?.merged?.adapters ?? {}
  }, [configRes?.sources?.merged?.adapters])

  const defaultAdapter = configRes?.sources?.merged?.general?.defaultAdapter

  const availableAdapterKeys = useMemo(() => {
    if (adapterCatalog.length > 0) {
      return adapterCatalog.map(entry => entry.instanceId)
    }
    return Object.keys(mergedAdapters)
  }, [adapterCatalog, mergedAdapters])

  const resolveAdapter = (value?: string) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    if (availableAdapterKeys.length === 0) return undefined
    if (normalizedValue !== '' && availableAdapterKeys.includes(normalizedValue)) return normalizedValue
    if (defaultAdapter && availableAdapterKeys.includes(defaultAdapter as string)) return defaultAdapter as string
    return availableAdapterKeys[0]
  }

  const updateSelectedAdapter = (value?: string) => {
    setSelectedAdapter((prev) => {
      const nextValue = resolveAdapter(value)
      return nextValue === prev ? prev : nextValue
    })
  }

  const adapterOptions = useMemo<Array<{ value: string; label: ReactNode }>>(() => {
    return availableAdapterKeys.map((key) => {
      const display = getAdapterDisplay(key)
      return {
        value: key,
        label: createElement('span', { className: 'adapter-option' }, [
          display.icon != null
            ? createElement('img', {
              key: 'icon',
              className: 'adapter-option__icon',
              src: display.icon,
              alt: '',
              'aria-hidden': true
            })
            : createElement('span', {
              key: 'fallback-icon',
              className: 'adapter-option__icon adapter-option__icon--fallback material-symbols-rounded',
              'aria-hidden': true
            }, 'deployed_code'),
          createElement('span', { key: 'text', className: 'adapter-option__text' }, display.title)
        ])
      }
    })
  }, [availableAdapterKeys, getAdapterDisplay])

  // Auto-select: use stored value if valid, else config default, else first available
  useEffect(() => {
    if (availableAdapterKeys.length === 0) {
      setSelectedAdapter(undefined)
      return
    }
    setSelectedAdapter((prev) => resolveAdapter(prev))
  }, [availableAdapterKeys, defaultAdapter, mergedAdapters])

  // Persist to localStorage
  useEffect(() => {
    try {
      if (selectedAdapter == null || selectedAdapter.trim() === '') {
        localStorage.removeItem(ADAPTER_STORAGE_KEY)
      } else {
        localStorage.setItem(ADAPTER_STORAGE_KEY, selectedAdapter)
      }
    } catch {}
  }, [selectedAdapter])

  return {
    selectedAdapter,
    setSelectedAdapter: updateSelectedAdapter,
    adapterOptions
  }
}
