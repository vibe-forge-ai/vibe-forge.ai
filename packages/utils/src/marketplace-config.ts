import type { ClaudeCodeMarketplaceOptions, MarketplaceConfig, MarketplaceConfigEntry } from '@vibe-forge/types'

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

const mergeMarketplaceEntry = (
  left: MarketplaceConfigEntry | undefined,
  right: MarketplaceConfigEntry | undefined
): MarketplaceConfigEntry | undefined => {
  if (left == null) return right
  if (right == null) return left
  if (left.type !== right.type) return right

  if (left.type === 'claude-code' && right.type === 'claude-code') {
    const options = mergeClaudeCodeMarketplaceOptions(left.options, right.options)
    return {
      type: 'claude-code',
      ...(right.enabled != null ? { enabled: right.enabled } : left.enabled != null ? { enabled: left.enabled } : {}),
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
