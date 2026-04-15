import type { ManagedPluginSource } from '@vibe-forge/types'
import { listManagedPluginInstalls } from '@vibe-forge/utils/managed-plugin'

import { addAdapterPlugin } from './managed-plugin-install'

const resolveMarketplacePluginAdapter = (type: string) => {
  switch (type) {
    case 'claude-code':
      return 'claude'
    default:
      return undefined
  }
}

const matchesMarketplaceSource = (
  source: ManagedPluginSource,
  marketplace: string,
  plugin: string
) => source.type === 'marketplace' && source.marketplace === marketplace && source.plugin === plugin

export const syncConfiguredMarketplacePlugins = async (params: {
  cwd: string
  marketplaces: Record<string, {
    type: string
    enabled?: boolean
    syncOnRun?: boolean
    plugins?: Record<string, {
      enabled?: boolean
      scope?: string
    }>
  }> | undefined
}) => {
  const results: Array<{
    marketplace: string
    plugin: string
    action: 'installed' | 'updated' | 'skipped'
  }> = []
  const marketplaces = Object.entries(params.marketplaces ?? {})
    .sort(([left], [right]) => left.localeCompare(right))

  for (const [marketplaceName, marketplace] of marketplaces) {
    if (marketplace.enabled === false) continue

    const adapter = resolveMarketplacePluginAdapter(marketplace.type)
    if (adapter == null) continue

    const installs = await listManagedPluginInstalls(params.cwd, { adapter })
    const plugins = Object.entries(marketplace.plugins ?? {})
      .sort(([left], [right]) => left.localeCompare(right))

    for (const [pluginName, plugin] of plugins) {
      if (plugin.enabled === false) continue

      const existingInstall = installs.find((install) => (
        matchesMarketplaceSource(install.config.source, marketplaceName, pluginName) ||
        install.config.name === pluginName
      ))
      const desiredScope = plugin.scope?.trim() !== '' ? plugin.scope?.trim() : undefined
      const shouldUpdate = existingInstall != null && (
        marketplace.syncOnRun === true ||
        (desiredScope ?? pluginName) !== (existingInstall.config.scope ?? existingInstall.config.name) ||
        !matchesMarketplaceSource(existingInstall.config.source, marketplaceName, pluginName)
      )

      if (existingInstall != null && !shouldUpdate) {
        results.push({
          marketplace: marketplaceName,
          plugin: pluginName,
          action: 'skipped'
        })
        continue
      }

      await addAdapterPlugin(adapter, {
        cwd: params.cwd,
        source: `${pluginName}@${marketplaceName}`,
        force: existingInstall != null,
        silent: true,
        ...(desiredScope != null ? { scope: desiredScope } : {})
      })
      results.push({
        marketplace: marketplaceName,
        plugin: pluginName,
        action: existingInstall == null ? 'installed' : 'updated'
      })
    }
  }

  return results
}
