import { join } from 'node:path'

import type {
  ClaudeCodeMarketplaceConfigEntry,
  ClaudeCodeMarketplacePluginDefinition,
  ClaudeCodeMarketplaceSource,
  MarketplaceConfigEntry
} from '@vibe-forge/types'
import type { ManagedPluginInstall } from '@vibe-forge/utils/managed-plugin'

import type { SkillHubItem, SkillHubRegistrySummary } from './types'

const toStringList = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()]
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim())
}

const toCapabilityNames = (value: unknown): string[] => {
  if (typeof value === 'string' || Array.isArray(value)) return toStringList(value)
  if (value != null && typeof value === 'object') return Object.keys(value)
  return []
}

const hasHookCapabilities = (value: unknown) => (
  typeof value === 'string' ||
  (Array.isArray(value) && value.length > 0) ||
  (value != null && typeof value === 'object' && Object.keys(value).length > 0)
)

const describeSource = (source: ClaudeCodeMarketplaceSource | undefined) => {
  if (source == null) return ''
  switch (source.source) {
    case 'directory':
      return source.path
    case 'github':
      return source.ref != null ? `${source.repo}#${source.ref}` : source.repo
    case 'git':
      return source.ref != null ? `${source.url}#${source.ref}` : source.url
    case 'hostPattern':
      return source.hostPattern
    case 'settings':
      return source.name ?? 'settings'
    case 'url':
      return source.url
  }
}

export const isClaudeMarketplace = (
  entry: MarketplaceConfigEntry | undefined
): entry is ClaudeCodeMarketplaceConfigEntry => entry?.type === 'claude-code'

export const toRegistries = (
  marketplaces: Record<string, MarketplaceConfigEntry> | undefined
): SkillHubRegistrySummary[] => (
  Object.entries(marketplaces ?? {})
    .filter(([, entry]) => isClaudeMarketplace(entry))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, entry]) => ({
      id,
      type: 'claude-code',
      enabled: entry.enabled !== false,
      searchable: entry.enabled !== false && entry.options?.source != null,
      source: describeSource(entry.options?.source)
    }))
)

export const createRegistryTempPath = (tempDir: string, registry: string) => (
  join(tempDir, registry.replace(/[^\w.-]+/g, '_') || 'registry')
)

const findMarketplaceInstall = (
  installs: ManagedPluginInstall[],
  registry: string,
  pluginName: string
) =>
  installs.find((install) => {
    const source = install.config.source
    return (
      (source.type === 'marketplace' && source.marketplace === registry && source.plugin === pluginName) ||
      install.config.name === pluginName
    )
  })

export const toHubItem = (
  plugin: ClaudeCodeMarketplacePluginDefinition,
  registry: string,
  installs: ManagedPluginInstall[]
): SkillHubItem => {
  const installed = findMarketplaceInstall(installs, registry, plugin.name)

  return {
    id: `${registry}:${plugin.name}`,
    registry,
    name: plugin.name,
    ...(plugin.description != null ? { description: plugin.description } : {}),
    ...(plugin.version != null ? { version: plugin.version } : {}),
    skills: toCapabilityNames(plugin.skills),
    commands: toCapabilityNames(plugin.commands),
    agents: toCapabilityNames(plugin.agents),
    mcpServers: toCapabilityNames(plugin.mcpServers),
    hasHooks: hasHookCapabilities(plugin.hooks),
    installed: installed != null,
    ...(installed?.config.scope != null ? { installScope: installed.config.scope } : {}),
    ...(installed?.config.installedAt != null ? { installedAt: installed.config.installedAt } : {})
  }
}

export const matchesQuery = (item: SkillHubItem, rawQuery: string) => {
  const query = rawQuery.trim().toLowerCase()
  if (query === '') return true
  const haystack = [
    item.registry,
    item.name,
    item.description,
    item.version,
    ...item.skills,
    ...item.commands,
    ...item.agents,
    ...item.mcpServers,
    item.hasHooks ? 'hooks' : ''
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

export const toErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)
