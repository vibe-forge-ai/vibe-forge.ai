import { asPlainRecord } from './object-utils'
import { LEGACY_TOOL_PERMISSION_ALIASES } from './tools'

export type PermissionValue = 'allow' | 'ask' | 'deny'
export type PermissionNode = PermissionValue | PermissionRecord
export interface PermissionRecord {
  [key: string]: PermissionNode
}

export const isPermissionValue = (value: unknown): value is PermissionValue => (
  value === 'allow' || value === 'ask' || value === 'deny'
)

export const normalizePermissionNode = (value: unknown): PermissionNode | undefined => {
  if (isPermissionValue(value)) return value

  const record = asPlainRecord(value)
  if (!record) return undefined

  const result: PermissionRecord = {}
  for (const [key, entry] of Object.entries(record)) {
    const normalized = normalizePermissionNode(entry)
    if (normalized != null) result[key] = normalized
  }

  return Object.keys(result).length > 0 ? result : {}
}

const clonePermissionNode = (value: PermissionNode | undefined): PermissionNode | undefined => {
  if (value == null || isPermissionValue(value)) return value
  const result: PermissionRecord = {}
  for (const [key, entry] of Object.entries(value)) {
    const cloned = clonePermissionNode(entry)
    if (cloned != null) result[key] = cloned
  }
  return result
}

const asPermissionRecord = (value: PermissionNode | undefined): PermissionRecord | undefined => (
  value != null && !isPermissionValue(value) ? value : undefined
)

const transformPermissionNode = (
  value: PermissionNode | undefined,
  transform: (entry: PermissionValue) => PermissionValue
): PermissionNode | undefined => {
  if (value == null || isPermissionValue(value)) return value == null ? undefined : transform(value)

  const result: PermissionRecord = {}
  for (const [key, entry] of Object.entries(value)) {
    const transformed = transformPermissionNode(entry, transform)
    if (transformed != null) result[key] = transformed
  }
  return result
}

const applyPermissionLevel = (base: PermissionNode | undefined, level: PermissionValue): PermissionNode => {
  if (base == null) return level
  if (isPermissionValue(base)) {
    if (level === 'deny') return 'deny'
    if (level === 'allow') return base === 'ask' ? 'allow' : base
    return base === 'allow' ? 'ask' : base
  }

  if (level === 'deny') return 'deny'
  const record = asPermissionRecord(transformPermissionNode(base, (entry) => (
    level === 'allow'
      ? (entry === 'ask' ? 'allow' : entry)
      : (entry === 'allow' ? 'ask' : entry)
  ))) ?? {}
  if (!('*' in record)) record['*'] = level
  return record
}

export const mergePermissionNodes = (
  base: PermissionNode | undefined,
  override: PermissionNode | undefined
): PermissionNode | undefined => {
  if (override == null) return clonePermissionNode(base)
  if (base == null) return clonePermissionNode(override)
  if (isPermissionValue(base)) {
    return isPermissionValue(override)
      ? override
      : mergePermissionNodes({ '*': base }, override)
  }
  if (isPermissionValue(override)) return applyPermissionLevel(base, override)

  const result: PermissionRecord = { ...(clonePermissionNode(base) as PermissionRecord) }
  for (const [key, value] of Object.entries(override)) {
    result[key] = mergePermissionNodes(result[key], value) as PermissionNode
  }
  return result
}

export const rewritePermissionMode = (
  value: PermissionNode | undefined,
  mode: 'dontAsk' | 'bypassPermissions'
): PermissionNode => {
  const transformed = transformPermissionNode(value, (entry) => (
    mode === 'bypassPermissions' || entry === 'ask' ? 'allow' : entry
  ))

  if (transformed == null || isPermissionValue(transformed)) return transformed ?? { '*': 'allow' }
  if (!('*' in transformed)) transformed['*'] = 'allow'
  return transformed
}

export const findPermissionEntry = (
  permission: PermissionNode | undefined,
  key: string
): PermissionNode | undefined => {
  const record = asPermissionRecord(permission)
  if (!record) return undefined
  if (key in record) return clonePermissionNode(record[key])

  for (const [alias, normalized] of Object.entries(LEGACY_TOOL_PERMISSION_ALIASES)) {
    if (normalized === key && alias in record) {
      return clonePermissionNode(record[alias] as PermissionNode)
    }
  }

  return undefined
}
