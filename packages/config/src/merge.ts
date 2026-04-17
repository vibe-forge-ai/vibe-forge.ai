import type { Config, NotificationConfig, NotificationEventConfig } from '@vibe-forge/types'
import { mergeAdapterConfigs, mergeMarketplaceConfigs, mergePluginConfigs } from '@vibe-forge/utils'

const hasOwnKeys = (value: Record<string, unknown>) => Object.keys(value).length > 0

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

export const mergeRecord = <T>(
  left?: Record<string, T>,
  right?: Record<string, T>
) => {
  if (left == null && right == null) return undefined

  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}

export const mergeList = <T>(
  left?: T[],
  right?: T[]
) => {
  if (left == null && right == null) return undefined
  return [
    ...(left ?? []),
    ...(right ?? [])
  ]
}

export const mergeUniqueList = <T>(
  left?: T[],
  right?: T[]
) => {
  const merged = mergeList(left, right)
  return merged == null ? undefined : Array.from(new Set(merged))
}

const mergeNotificationEventConfigs = (
  left?: Partial<Record<string, NotificationEventConfig>>,
  right?: Partial<Record<string, NotificationEventConfig>>
) => {
  const keys = new Set([
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {})
  ])

  if (keys.size === 0) return undefined

  const merged = Object.fromEntries(
    Array.from(keys).map((key) => [
      key,
      {
        ...(left?.[key] ?? {}),
        ...(right?.[key] ?? {})
      }
    ])
  ) as Partial<Record<string, NotificationEventConfig>>

  return hasOwnKeys(merged as Record<string, unknown>) ? merged : undefined
}

const mergeNotifications = (
  left?: NotificationConfig,
  right?: NotificationConfig
) => {
  if (left == null && right == null) return undefined

  const merged: NotificationConfig = {
    ...(left ?? {}),
    ...(right ?? {}),
    events: mergeNotificationEventConfigs(left?.events, right?.events)
  }

  return hasOwnKeys(merged as Record<string, unknown>) ? merged : undefined
}

const mergePermissions = (
  left?: Config['permissions'],
  right?: Config['permissions']
) => {
  if (left == null && right == null) return undefined

  const merged: NonNullable<Config['permissions']> = {
    ...(left ?? {}),
    ...(right ?? {}),
    allow: mergeList(left?.allow, right?.allow),
    deny: mergeList(left?.deny, right?.deny),
    ask: mergeList(left?.ask, right?.ask)
  }

  return hasOwnKeys(merged as Record<string, unknown>) ? merged : undefined
}

export function mergeConfigs(left: undefined, right: undefined): undefined
export function mergeConfigs<T extends Partial<Config>>(left: T, right: T): T
export function mergeConfigs<T extends Partial<Config>>(left: T | undefined, right: T): T
export function mergeConfigs<T extends Partial<Config>>(left: T, right: T | undefined): T
export function mergeConfigs<T extends Partial<Config>>(left?: T, right?: T): T | undefined
export function mergeConfigs<T extends Partial<Config>>(left?: T, right?: T) {
  const merged = {
    ...(left ?? {}),
    ...(right ?? {}),
    adapters: mergeAdapterConfigs(
      left?.adapters as Record<string, unknown> | undefined,
      right?.adapters as Record<string, unknown> | undefined
    ) as Config['adapters'],
    models: mergeRecord(left?.models, right?.models),
    modelServices: mergeRecord(left?.modelServices, right?.modelServices),
    channels: mergeRecord(left?.channels, right?.channels),
    mcpServers: mergeRecord(left?.mcpServers, right?.mcpServers),
    defaultIncludeMcpServers: mergeUniqueList(
      left?.defaultIncludeMcpServers,
      right?.defaultIncludeMcpServers
    ),
    defaultExcludeMcpServers: mergeUniqueList(
      left?.defaultExcludeMcpServers,
      right?.defaultExcludeMcpServers
    ),
    permissions: mergePermissions(left?.permissions, right?.permissions),
    env: mergeRecord(left?.env, right?.env),
    announcements: mergeList(left?.announcements, right?.announcements),
    shortcuts: mergeRecord(left?.shortcuts, right?.shortcuts),
    conversation: mergeRecord(
      left?.conversation as Record<string, unknown> | undefined,
      right?.conversation as Record<string, unknown> | undefined
    ) as Config['conversation'],
    webAuth: mergeRecord(
      left?.webAuth as Record<string, unknown> | undefined,
      right?.webAuth as Record<string, unknown> | undefined
    ) as Config['webAuth'],
    notifications: mergeNotifications(left?.notifications, right?.notifications),
    plugins: mergePluginConfigs(left?.plugins, right?.plugins) as Config['plugins'],
    marketplaces: mergeMarketplaceConfigs(left?.marketplaces, right?.marketplaces)
  }

  return merged as T
}
