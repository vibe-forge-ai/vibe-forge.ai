import type { Config } from '@vibe-forge/types'
import { isLegacySkillsConfig, resolveConfiguredSkillInstalls } from '@vibe-forge/utils'

const hasOwnKeys = (value: Record<string, unknown>) => Object.keys(value).length > 0

const mergeList = <T>(
  left?: T[],
  right?: T[]
) => {
  if (left == null && right == null) return undefined
  return [
    ...(left ?? []),
    ...(right ?? [])
  ]
}

const mergeOptionalList = <T>(
  left?: T[],
  right?: T[]
) => {
  const merged = mergeList(left, right)
  return merged == null || merged.length === 0 ? undefined : merged
}

const isObjectValue = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  !Array.isArray(value) &&
  typeof value === 'object'
)

const mergeSkillRegistry = (
  left?: Config['skills'],
  right?: Config['skills']
) => {
  const leftRegistry = isLegacySkillsConfig(left) ? left.registry : undefined
  const rightRegistry = isLegacySkillsConfig(right) ? right.registry : undefined

  if (leftRegistry == null && rightRegistry == null) return undefined
  if (leftRegistry == null) return rightRegistry
  if (rightRegistry == null) return leftRegistry
  if (!isObjectValue(rightRegistry)) return rightRegistry

  return hasOwnKeys(rightRegistry) ? rightRegistry : undefined
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

const mergeAutoDownloadDependencies = (
  left?: Config['skills'],
  right?: Config['skills']
) => {
  const leftValue = isLegacySkillsConfig(left) ? left.autoDownloadDependencies : undefined
  const rightValue = isLegacySkillsConfig(right) ? right.autoDownloadDependencies : undefined
  return rightValue ?? leftValue
}

export const mergeSkills = (
  left?: Config['skills'],
  right?: Config['skills']
) => {
  const installs = mergeOptionalList(
    resolveConfiguredSkillInstalls(left),
    resolveConfiguredSkillInstalls(right)
  )
  const autoDownloadDependencies = mergeAutoDownloadDependencies(left, right)
  const registry = mergeSkillRegistry(left, right)
  const homeBridge = mergeSkillHomeBridge(left, right)

  if (autoDownloadDependencies == null && registry == null && homeBridge == null) {
    return installs
  }

  return {
    ...(autoDownloadDependencies == null ? {} : { autoDownloadDependencies }),
    ...(installs == null ? {} : { install: installs }),
    ...(registry == null ? {} : { registry }),
    ...(homeBridge == null ? {} : { homeBridge })
  }
}
