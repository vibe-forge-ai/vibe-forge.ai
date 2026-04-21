import type { Config, NotificationConfig, NotificationEventConfig } from '@vibe-forge/types'
import {
  isLegacySkillsConfig,
  mergeAdapterConfigs,
  mergeMarketplaceConfigs,
  mergePluginConfigs,
  resolveConfiguredSkillInstalls,
  resolveSkillsCliRuntimeConfig
} from '@vibe-forge/utils'

import { mergeWorkspaceConfigs } from './workspace-config'

const hasOwnKeys = (value: Record<string, unknown>) => Object.keys(value).length > 0
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

const mergeConversation = (
  left?: Config['conversation'],
  right?: Config['conversation']
) => {
  if (left == null && right == null) return undefined

  const merged: NonNullable<Config['conversation']> = {
    ...(left ?? {}),
    ...(right ?? {}),
    startupPresets: mergeList(left?.startupPresets, right?.startupPresets),
    builtinActions: mergeList(left?.builtinActions, right?.builtinActions)
  }

  return hasOwnKeys(merged as Record<string, unknown>) ? merged : undefined
}

const mergeSkillHomeBridge = (
  left?: Config['skills'],
  right?: Config['skills']
) => {
  const leftHomeBridge = isLegacySkillsConfig(left) ? left.homeBridge : undefined
  const rightHomeBridge = isLegacySkillsConfig(right) ? right.homeBridge : undefined

  if (leftHomeBridge == null && rightHomeBridge == null) return undefined

  const merged = {
    ...(leftHomeBridge ?? {}),
    ...(rightHomeBridge ?? {})
  }

  return hasOwnKeys(merged as Record<string, unknown>) ? merged : undefined
}

const mergeSkills = (
  left?: Config['skills'],
  right?: Config['skills']
) => {
  const installs = mergeList(
    resolveConfiguredSkillInstalls(left),
    resolveConfiguredSkillInstalls(right)
  )
  const homeBridge = mergeSkillHomeBridge(left, right)

  if (homeBridge == null) {
    return installs
  }

  return {
    ...(installs == null ? {} : { install: installs }),
    homeBridge
  }
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
    workspaces: mergeWorkspaceConfigs(left?.workspaces, right?.workspaces),
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
    conversation: mergeConversation(left?.conversation, right?.conversation),
    webAuth: mergeRecord(
      left?.webAuth as Record<string, unknown> | undefined,
      right?.webAuth as Record<string, unknown> | undefined
    ) as Config['webAuth'],
    notifications: mergeNotifications(left?.notifications, right?.notifications),
    skills: mergeSkills(left?.skills, right?.skills),
    skillsCli: mergeRecord(
      resolveSkillsCliRuntimeConfig(left) as Record<string, unknown> | undefined,
      resolveSkillsCliRuntimeConfig(right) as Record<string, unknown> | undefined
    ) as Config['skillsCli'],
    plugins: mergePluginConfigs(left?.plugins, right?.plugins) as Config['plugins'],
    marketplaces: mergeMarketplaceConfigs(left?.marketplaces, right?.marketplaces)
  }

  return merged as T
}
