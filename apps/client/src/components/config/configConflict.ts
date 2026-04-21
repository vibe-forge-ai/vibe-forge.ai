import type { ConfigSource } from '@vibe-forge/core'

export type ConfigRemoteChangeAction = 'none' | 'sync-remote' | 'conflict'

const normalizeComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeComparableValue(item))
  }

  if (value != null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeComparableValue((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

export const getConfigDraftKey = (sectionKey: string, source: ConfigSource) => `${source}:${sectionKey}`

export const serializeComparableConfigValue = (value: unknown) => (
  JSON.stringify(normalizeComparableValue(value ?? {}))
)

export const resolveRemoteConfigChangeAction = ({
  baseSerialized,
  draftSerialized,
  serverSerialized
}: {
  baseSerialized?: string
  draftSerialized?: string
  serverSerialized: string
}): ConfigRemoteChangeAction => {
  if (baseSerialized == null || draftSerialized == null) return 'none'
  if (baseSerialized === serverSerialized || draftSerialized === serverSerialized) return 'none'
  if (draftSerialized === baseSerialized) return 'sync-remote'
  return 'conflict'
}
