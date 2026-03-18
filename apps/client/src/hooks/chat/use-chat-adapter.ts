import { type ReactNode, createElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

import { getConfig } from '#~/api.js'
import { getAdapterDisplay } from '#~/resources/adapters.js'
import type { ConfigResponse } from '@vibe-forge/core'

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

  const mergedAdapters = useMemo(() => {
    return configRes?.sources?.merged?.adapters ?? {}
  }, [configRes?.sources?.merged?.adapters])

  const defaultAdapter = configRes?.sources?.merged?.general?.defaultAdapter

  const resolveAdapter = (value?: string) => {
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    const keys = Object.keys(mergedAdapters)
    if (keys.length === 0) return undefined
    if (normalizedValue !== '' && keys.includes(normalizedValue)) return normalizedValue
    if (defaultAdapter && keys.includes(defaultAdapter as string)) return defaultAdapter as string
    return keys[0]
  }

  const updateSelectedAdapter = (value?: string) => {
    setSelectedAdapter((prev) => {
      const nextValue = resolveAdapter(value)
      return nextValue === prev ? prev : nextValue
    })
  }

  const adapterOptions = useMemo<Array<{ value: string; label: ReactNode }>>(() => {
    const keys = Object.keys(mergedAdapters)
    return keys.map((key) => {
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
            : null,
          createElement('span', { key: 'text', className: 'adapter-option__text' }, display.title)
        ])
      }
    })
  }, [mergedAdapters])

  // Auto-select: use stored value if valid, else config default, else first available
  useEffect(() => {
    const keys = Object.keys(mergedAdapters)
    if (keys.length === 0) {
      setSelectedAdapter(undefined)
      return
    }
    setSelectedAdapter((prev) => resolveAdapter(prev))
  }, [defaultAdapter, mergedAdapters])

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
