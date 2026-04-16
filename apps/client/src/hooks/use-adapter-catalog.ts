import { useCallback, useMemo } from 'react'
import useSWR from 'swr'

import type { AdapterBuiltinModel, AdapterCatalogCapabilities, AdapterCatalogEntry, AdapterCatalogResponse } from '@vibe-forge/types'

import { getAdapterCatalog } from '#~/api'
import { getAdapterDisplay as getFallbackAdapterDisplay } from '#~/resources/adapters'

const EMPTY_CAPABILITIES: AdapterCatalogCapabilities = {}

export function useAdapterCatalog() {
  const { data, error, isLoading } = useSWR<AdapterCatalogResponse>('/api/adapter-catalog', getAdapterCatalog)

  const adapterCatalog = data?.adapters ?? []

  const adapterCatalogById = useMemo(() => {
    return adapterCatalog.reduce<Record<string, AdapterCatalogEntry>>((acc, entry) => {
      acc[entry.instanceId] = entry
      return acc
    }, {})
  }, [adapterCatalog])

  const adapterBuiltinModels = useMemo(() => {
    return adapterCatalog.reduce<Record<string, AdapterBuiltinModel[]>>((acc, entry) => {
      acc[entry.instanceId] = entry.builtinModels
      return acc
    }, {})
  }, [adapterCatalog])

  const getAdapterDisplay = useCallback((adapterKey: string) => {
    const entry = adapterCatalogById[adapterKey]
    if (entry != null) {
      return {
        title: entry.title,
        icon: entry.icon
      }
    }

    return getFallbackAdapterDisplay(adapterKey)
  }, [adapterCatalogById])

  const getAdapterCapabilities = useCallback((adapterKey: string) => {
    return adapterCatalogById[adapterKey]?.capabilities ?? EMPTY_CAPABILITIES
  }, [adapterCatalogById])

  return {
    adapterBuiltinModels,
    adapterCatalog,
    adapterCatalogById,
    error,
    getAdapterCapabilities,
    getAdapterDisplay,
    isLoading
  }
}
