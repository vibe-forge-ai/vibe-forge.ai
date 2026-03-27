import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'

import {
  findPermissionEntry,
  isPermissionValue
  
  
  
} from './permission-node'
import type {PermissionNode, PermissionRecord, PermissionValue} from './permission-node';
import { LEGACY_TOOL_PERMISSION_ALIASES } from './tools'

const OPENCODE_PERMISSION_KEYS = [
  'bash', 'edit', 'glob', 'grep', 'question', 'read', 'list', 'lsp', 'skill',
  'task', 'todoread', 'todowrite', 'webfetch', 'websearch', 'codesearch'
]

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
