import type {
  ClaudeCodeMarketplaceOptions,
  MarketplaceConfig,
  MarketplaceConfigEntry,
  MarketplaceDeclaredPluginConfig
} from '@vibe-forge/types'

import { normalizeMarketplaceConfig } from './marketplace-config-source'
export { normalizeMarketplaceConfig } from './marketplace-config-source'

const mergeClaudeCodeMarketplaceOptions = (
  left?: ClaudeCodeMarketplaceOptions,
  right?: ClaudeCodeMarketplaceOptions
): ClaudeCodeMarketplaceOptions | undefined => {
  if (left == null && right == null) return undefined
  const source = right?.source ?? left?.source
  if (source == null) return undefined
  return {
    ...(left ?? {}),
    ...(right ?? {}),
    source
  }
}

const mergeMarketplaceDeclaredPluginEntry = (
  left?: MarketplaceDeclaredPluginConfig,
  right?: MarketplaceDeclaredPluginConfig
): MarketplaceDeclaredPluginConfig | undefined => {
  if (left == null) return right
  if (right == null) return left

  return {
    ...(right.enabled != null ? { enabled: right.enabled } : left.enabled != null ? { enabled: left.enabled } : {}),
    ...(right.scope != null ? { scope: right.scope } : left.scope != null ? { scope: left.scope } : {})
  }
}

const mergeMarketplaceDeclaredPlugins = (
  left?: Record<string, MarketplaceDeclaredPluginConfig>,
  right?: Record<string, MarketplaceDeclaredPluginConfig>
) => {
  if (left == null && right == null) return undefined

  const keys = new Set([
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {})
  ])
  const entries = Array.from(keys)
    .map((key) => {
      const mergedEntry = mergeMarketplaceDeclaredPluginEntry(left?.[key], right?.[key])
      return mergedEntry == null ? undefined : [key, mergedEntry] as const
    })
    .filter((entry): entry is readonly [string, MarketplaceDeclaredPluginConfig] => entry != null)

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const mergeMarketplaceEntry = (
  left: MarketplaceConfigEntry | undefined,
  right: MarketplaceConfigEntry | undefined
): MarketplaceConfigEntry | undefined => {
  if (left == null) return right
  if (right == null) return left
  if (left.type !== right.type) return right

  if (left.type === 'claude-code' && right.type === 'claude-code') {
    const options = mergeClaudeCodeMarketplaceOptions(left.options, right.options)
    const plugins = mergeMarketplaceDeclaredPlugins(left.plugins, right.plugins)
    return {
      type: 'claude-code',
      ...(right.enabled != null ? { enabled: right.enabled } : left.enabled != null ? { enabled: left.enabled } : {}),
      ...(right.syncOnRun != null
        ? { syncOnRun: right.syncOnRun }
        : left.syncOnRun != null
        ? { syncOnRun: left.syncOnRun }
        : {}),
      ...(plugins != null ? { plugins } : {}),
      ...(options != null ? { options } : {})
    }
  }

  return right
}

export const mergeMarketplaceConfigs = (
  left?: MarketplaceConfig,
  right?: MarketplaceConfig
): MarketplaceConfig | undefined => {
  const normalizedLeft = normalizeMarketplaceConfig(left)
  const normalizedRight = normalizeMarketplaceConfig(right)
  if (normalizedLeft == null && normalizedRight == null) return undefined

  const keys = new Set([
    ...Object.keys(normalizedLeft ?? {}),
    ...Object.keys(normalizedRight ?? {})
  ])

  const entries = Array.from(keys)
    .map((key) => {
      const entry = mergeMarketplaceEntry(
        normalizedLeft?.[key],
        normalizedRight?.[key]
      )
      return entry == null ? undefined : [key, entry] as const
    })
    .filter((entry): entry is readonly [string, MarketplaceConfigEntry] => entry != null)

  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
