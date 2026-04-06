import type { AdapterQueryOptions, Config } from '@vibe-forge/types'
import { splitManagedPermissionKeys } from '@vibe-forge/utils'

import { findPermissionEntry, isPermissionValue } from './permission-node'
import type { PermissionNode, PermissionRecord, PermissionValue } from './permission-node'
import { LEGACY_TOOL_PERMISSION_ALIASES } from './tools'

const OPENCODE_PERMISSION_KEYS = [
  'bash',
  'edit',
  'glob',
  'grep',
  'question',
  'read',
  'list',
  'lsp',
  'skill',
  'task',
  'todoread',
  'todowrite',
  'webfetch',
  'websearch',
  'codesearch'
]

const CANONICAL_TO_OPENCODE_PERMISSION_KEY: Record<string, string> = {
  Bash: 'bash',
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  Glob: 'glob',
  Grep: 'grep',
  List: 'list',
  Lsp: 'lsp',
  Task: 'task',
  Skill: 'skill',
  Question: 'question',
  TodoRead: 'todoread',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch'
}

export const mapPermissionModeToOpenCode = (
  permissionMode: AdapterQueryOptions['permissionMode']
): PermissionRecord | undefined => {
  if (permissionMode == null) return undefined
  if (permissionMode === 'dontAsk' || permissionMode === 'bypassPermissions') return { '*': 'allow' as const }
  if (permissionMode === 'acceptEdits') return { '*': 'allow' as const, bash: 'ask', edit: 'allow', task: 'ask' }
  if (permissionMode === 'plan') return { '*': 'allow' as const, bash: 'ask', edit: 'deny', task: 'deny' }
  return { '*': 'allow' as const, bash: 'ask', edit: 'ask', task: 'ask' }
}

const normalizePermissionToolKey = (value: string) => {
  const key = value.trim()
  if (key === '') return undefined
  return LEGACY_TOOL_PERMISSION_ALIASES[key] ?? key
}

const resolvePermissionValue = (
  key: string,
  basePermission: PermissionNode | undefined
): PermissionValue => {
  const explicit = findPermissionEntry(basePermission, key)
  if (isPermissionValue(explicit)) return explicit

  const wildcard = findPermissionEntry(basePermission, '*')
  if (isPermissionValue(wildcard)) return wildcard

  return isPermissionValue(basePermission) ? basePermission : 'allow'
}

export const buildToolPermissionConfig = (
  tools: AdapterQueryOptions['tools'],
  basePermission: PermissionNode | undefined = undefined
) => {
  const includes = new Set((tools?.include ?? []).map(normalizePermissionToolKey).filter(Boolean) as string[])
  const excludes = new Set((tools?.exclude ?? []).map(normalizePermissionToolKey).filter(Boolean) as string[])
  const allowAllTools = includes.delete('*')

  if (includes.size === 0 && excludes.size === 0) return undefined

  const result: PermissionRecord = {}
  const explicitKeys = Object.keys(
    isPermissionValue(basePermission) || basePermission == null ? {} : basePermission
  ).map(normalizePermissionToolKey).filter((value): value is string => value != null && value !== '*')

  if (includes.size > 0 && !allowAllTools) {
    result['*'] = 'deny'
    for (const key of new Set([...OPENCODE_PERMISSION_KEYS, ...explicitKeys])) {
      if (!includes.has(key)) result[key] = 'deny'
    }
    for (const key of includes) {
      result[key] = findPermissionEntry(basePermission, key) ?? resolvePermissionValue(key, basePermission)
    }
  }

  for (const key of excludes) result[key] = 'deny'
  return result
}

const mapManagedPermissionKeyToOpenCode = (value: string) => {
  const normalized = value.trim()
  if (normalized === '') return undefined
  if (normalized in CANONICAL_TO_OPENCODE_PERMISSION_KEY) {
    return CANONICAL_TO_OPENCODE_PERMISSION_KEY[normalized]
  }
  return /^[_A-Za-z][_A-Za-z0-9-]*$/.test(normalized)
    ? `mcp__${normalized}__*`
    : undefined
}

export const buildManagedPermissionConfig = (
  permissions: Config['permissions'] | undefined
): PermissionRecord | undefined => {
  const allow = splitManagedPermissionKeys(permissions?.allow).bare
  const deny = splitManagedPermissionKeys(permissions?.deny).bare
  const ask = splitManagedPermissionKeys(permissions?.ask).bare
  const result: PermissionRecord = {}

  for (const [values, decision] of [
    [allow, 'allow'],
    [ask, 'ask'],
    [deny, 'deny']
  ] as const) {
    for (const value of values) {
      const mapped = mapManagedPermissionKeyToOpenCode(value)
      if (mapped == null) continue
      result[mapped] = decision
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}
