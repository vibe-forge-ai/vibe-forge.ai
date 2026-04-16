import type { AdapterCatalogEntry, AdapterCatalogResponse, Config } from '@vibe-forge/types'
import { loadAdapterManifest, resolveAdapterPackageNameForConfigEntry } from '@vibe-forge/types'

import { loadConfigState } from '#~/services/config/index.js'

const buildAdapterCatalogEntries = (config: Config | undefined): AdapterCatalogEntry[] => {
  const adapterEntries = Object.entries(config?.adapters ?? {})

  return adapterEntries
    .map(([instanceId, adapterConfig]) => {
      const manifest = loadAdapterManifest(instanceId, adapterConfig)
      return {
        instanceId,
        packageId: resolveAdapterPackageNameForConfigEntry(instanceId, adapterConfig),
        title: manifest.title,
        icon: manifest.icon,
        builtinModels: manifest.builtinModels ?? [],
        capabilities: manifest.capabilities
      } satisfies AdapterCatalogEntry
    })
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId))
}

export const loadAdapterCatalog = async (): Promise<AdapterCatalogResponse> => {
  const { mergedConfig } = await loadConfigState()
  return {
    adapters: buildAdapterCatalogEntries(mergedConfig)
  }
}
