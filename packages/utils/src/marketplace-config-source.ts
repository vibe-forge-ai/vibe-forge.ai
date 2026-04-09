import type {
  ClaudeCodeMarketplaceConfigEntry,
  ClaudeCodeMarketplaceOptions,
  ClaudeCodeMarketplaceSource,
  MarketplaceConfig,
  MarketplaceConfigEntry
} from '@vibe-forge/types'

import { normalizeMarketplacePluginDefinition } from './marketplace-config-plugin'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

export interface NormalizeMarketplaceConfigOptions {
  allowSettingsPathPluginSources?: boolean
}

const normalizeClaudeCodeMarketplaceSource = (
  value: unknown,
  path: string,
  options: NormalizeMarketplaceConfigOptions = {}
): ClaudeCodeMarketplaceSource => {
  if (!isRecord(value) || typeof value.source !== 'string') {
    throw new TypeError(`Invalid marketplace source at ${path}.`)
  }

  switch (value.source) {
    case 'github': {
      const repo = normalizeNonEmptyString(value.repo)
      if (repo == null) {
        throw new TypeError(`Invalid marketplace source at ${path}. "repo" must be a non-empty string.`)
      }
      return {
        source: 'github',
        repo,
        ...(normalizeNonEmptyString(value.ref) != null ? { ref: normalizeNonEmptyString(value.ref) } : {}),
        ...(normalizeNonEmptyString(value.path) != null ? { path: normalizeNonEmptyString(value.path) } : {})
      }
    }
    case 'git': {
      const url = normalizeNonEmptyString(value.url)
      if (url == null) {
        throw new TypeError(`Invalid marketplace source at ${path}. "url" must be a non-empty string.`)
      }
      return {
        source: 'git',
        url,
        ...(normalizeNonEmptyString(value.ref) != null ? { ref: normalizeNonEmptyString(value.ref) } : {}),
        ...(normalizeNonEmptyString(value.path) != null ? { path: normalizeNonEmptyString(value.path) } : {})
      }
    }
    case 'directory': {
      const directoryPath = normalizeNonEmptyString(value.path)
      if (directoryPath == null) {
        throw new TypeError(`Invalid marketplace source at ${path}. "path" must be a non-empty string.`)
      }
      return {
        source: 'directory',
        path: directoryPath
      }
    }
    case 'url': {
      const url = normalizeNonEmptyString(value.url)
      if (url == null) {
        throw new TypeError(`Invalid marketplace source at ${path}. "url" must be a non-empty string.`)
      }
      return {
        source: 'url',
        url
      }
    }
    case 'settings': {
      if (!Array.isArray(value.plugins)) {
        throw new TypeError(`Invalid marketplace source at ${path}. "plugins" must be an array.`)
      }
      const metadata = isRecord(value.metadata)
        ? {
          ...(normalizeNonEmptyString(value.metadata.pluginRoot) != null
            ? { pluginRoot: normalizeNonEmptyString(value.metadata.pluginRoot) }
            : {})
        }
        : undefined
      return {
        source: 'settings',
        ...(normalizeNonEmptyString(value.name) != null ? { name: normalizeNonEmptyString(value.name) } : {}),
        ...(metadata != null ? { metadata } : {}),
        plugins: value.plugins.map((plugin, index) => (
          normalizeMarketplacePluginDefinition(
            plugin,
            `${path}.plugins[${index}]`,
            { allowPathStringSource: options.allowSettingsPathPluginSources === true }
          )
        ))
      }
    }
    case 'hostPattern': {
      const hostPattern = normalizeNonEmptyString(value.hostPattern)
      if (hostPattern == null) {
        throw new TypeError(`Invalid marketplace source at ${path}. "hostPattern" must be a non-empty string.`)
      }
      return {
        source: 'hostPattern',
        hostPattern
      }
    }
    default:
      throw new TypeError(`Unsupported marketplace source "${String(value.source)}" at ${path}.`)
  }
}

const normalizeMarketplaceEntry = (
  value: unknown,
  path: string,
  options: NormalizeMarketplaceConfigOptions = {}
): MarketplaceConfigEntry => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new TypeError(`Invalid marketplace entry at ${path}. Expected an object with a "type" field.`)
  }

  switch (value.type) {
    case 'claude-code': {
      const entry: ClaudeCodeMarketplaceConfigEntry = {
        type: 'claude-code',
        ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {})
      }
      if (value.options != null) {
        if (!isRecord(value.options)) {
          throw new TypeError(`Invalid marketplace entry at ${path}. "options" must be an object.`)
        }
        if (value.options.source == null) {
          throw new TypeError(`Invalid marketplace entry at ${path}. "options.source" is required.`)
        }
        entry.options = {
          source: normalizeClaudeCodeMarketplaceSource(value.options.source, `${path}.options.source`, options)
        } satisfies ClaudeCodeMarketplaceOptions
      }
      return entry
    }
    default:
      throw new TypeError(`Unsupported marketplace type "${String(value.type)}" at ${path}.`)
  }
}

export const normalizeMarketplaceConfig = (
  marketplaces: MarketplaceConfig | undefined,
  path: string = 'marketplaces',
  options: NormalizeMarketplaceConfigOptions = {}
): MarketplaceConfig | undefined => {
  if (marketplaces == null) return undefined
  if (!isRecord(marketplaces)) {
    throw new TypeError(`Invalid ${path} config. "marketplaces" must be a record keyed by marketplace name.`)
  }

  return Object.fromEntries(
    Object.entries(marketplaces).map(([name, entry]) => {
      const normalizedName = normalizeNonEmptyString(name)
      if (normalizedName == null) {
        throw new TypeError(`Invalid marketplace key at ${path}. Marketplace names must be non-empty strings.`)
      }
      return [normalizedName, normalizeMarketplaceEntry(entry, `${path}.${normalizedName}`, options)]
    })
  )
}
