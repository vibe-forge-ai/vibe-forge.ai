import type { MarketplaceDeclaredPluginConfig } from '@vibe-forge/types'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const normalizeMarketplaceDeclaredPluginConfig = (
  value: unknown,
  path: string
): MarketplaceDeclaredPluginConfig => {
  if (typeof value === 'boolean') {
    return { enabled: value }
  }
  if (!isRecord(value)) {
    throw new TypeError(`Invalid marketplace plugin entry at ${path}. Expected a boolean or object.`)
  }

  return {
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
    ...(normalizeNonEmptyString(value.scope) != null ? { scope: normalizeNonEmptyString(value.scope) } : {})
  }
}

export const normalizeMarketplaceDeclaredPlugins = (
  value: unknown,
  path: string
): Record<string, MarketplaceDeclaredPluginConfig> => {
  if (!isRecord(value)) {
    throw new TypeError(`Invalid marketplace plugins at ${path}. Expected a record keyed by plugin name.`)
  }

  return Object.fromEntries(
    Object.entries(value).map(([name, entry]) => {
      const normalizedName = normalizeNonEmptyString(name)
      if (normalizedName == null) {
        throw new TypeError(`Invalid marketplace plugin key at ${path}. Plugin names must be non-empty strings.`)
      }
      return [normalizedName, normalizeMarketplaceDeclaredPluginConfig(entry, `${path}.${normalizedName}`)]
    })
  )
}
