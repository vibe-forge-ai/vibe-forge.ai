import { buildConfigJsonVariables, loadConfigState } from '@vibe-forge/config'
import type { AdapterPluginResolveSourceContext, Config, ResolvedAdapterPluginSource } from '@vibe-forge/types'

import { loadMarketplaceCatalogFromSource } from './marketplace-catalog'
import { resolveMarketplacePluginSource, toMarketplaceManifestOverrides } from './marketplace-source'
import type { ClaudePluginManifest } from './source'

const EXPLICIT_NON_MARKETPLACE_PREFIXES = [
  'npm:',
  'github:',
  'git+',
  'http://',
  'https://',
  'ssh://',
  'git@',
  './',
  '../',
  '/'
] as const

const parseMarketplaceInstallReference = (value: string) => {
  if (
    value.startsWith('@') ||
    EXPLICIT_NON_MARKETPLACE_PREFIXES.some(prefix => value.startsWith(prefix)) ||
    /^[a-z]:[\\/]/i.test(value)
  ) {
    return undefined
  }

  const separatorIndex = value.lastIndexOf('@')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return undefined
  }

  const plugin = value.slice(0, separatorIndex).trim()
  const marketplace = value.slice(separatorIndex + 1).trim()
  if (plugin === '' || marketplace === '') {
    return undefined
  }

  return {
    plugin,
    marketplace
  }
}

const getConfiguredClaudeMarketplace = (config: Config | undefined, marketplaceName: string) => {
  const marketplace = config?.marketplaces?.[marketplaceName]
  if (marketplace?.type !== 'claude-code') return undefined
  return marketplace
}

export const resolveClaudeMarketplaceInstallSource = async (
  params: AdapterPluginResolveSourceContext
): Promise<ResolvedAdapterPluginSource<ClaudePluginManifest> | undefined> => {
  const reference = parseMarketplaceInstallReference(params.requestedSource)
  if (reference == null) return undefined

  const { mergedConfig } = await loadConfigState({
    cwd: params.cwd,
    jsonVariables: buildConfigJsonVariables(params.cwd)
  })
  const configuredMarketplace = getConfiguredClaudeMarketplace(mergedConfig, reference.marketplace)
  if (configuredMarketplace == null) {
    throw new Error(
      `Ambiguous Claude plugin source "${params.requestedSource}". No Claude marketplace named "${reference.marketplace}" is configured. Use "npm:${params.requestedSource}" to install an npm package, or configure that marketplace first.`
    )
  }
  if (configuredMarketplace.enabled === false) {
    throw new Error(`Claude marketplace ${reference.marketplace} is disabled in config.`)
  }
  if (configuredMarketplace.options?.source == null) {
    throw new Error(`Claude marketplace ${reference.marketplace} is missing options.source in config.`)
  }

  const { catalog, rootDir } = await loadMarketplaceCatalogFromSource(
    params.tempDir,
    configuredMarketplace.options.source,
    reference.marketplace,
    params.installSource
  )
  const plugin = catalog.plugins.find(entry => entry.name === reference.plugin)
  if (plugin == null) {
    throw new Error(`Claude marketplace plugin ${reference.plugin}@${reference.marketplace} was not found.`)
  }

  return {
    installSource: resolveMarketplacePluginSource({
      source: plugin.source,
      catalog,
      rootDir,
      marketplaceName: reference.marketplace,
      pluginName: reference.plugin
    }),
    managedSource: {
      type: 'marketplace',
      marketplace: reference.marketplace,
      plugin: reference.plugin
    },
    manifestOverrides: toMarketplaceManifestOverrides(plugin)
  }
}
