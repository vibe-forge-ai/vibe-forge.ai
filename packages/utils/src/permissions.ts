import { resolveProjectAiPath } from './ai-path'

import { isBarePermissionKey, normalizePermissionToolName } from './permission-tool'

export { CANONICAL_PERMISSION_TOOL_KEYS, isBarePermissionKey, normalizePermissionToolName } from './permission-tool'
export type { CanonicalPermissionToolKey, PermissionToolSubject } from './permission-tool'

export interface SessionPermissionState {
  allow: string[]
  deny: string[]
  onceAllow: string[]
  onceDeny: string[]
}

const uniqueStrings = (values: string[]) => [...new Set(values)]

export const createEmptySessionPermissionState = (): SessionPermissionState => ({
  allow: [],
  deny: [],
  onceAllow: [],
  onceDeny: []
})

export const normalizeSessionPermissionState = (value: unknown): SessionPermissionState => {
  const record = value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const normalizeList = (input: unknown) =>
    uniqueStrings(
      Array.isArray(input)
        ? input
          .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
          .map(item => normalizePermissionToolName(item)?.key ?? item.trim())
        : []
    )

  return {
    allow: normalizeList(record.allow),
    deny: normalizeList(record.deny),
    onceAllow: normalizeList(record.onceAllow),
    onceDeny: normalizeList(record.onceDeny)
  }
}

export const splitManagedPermissionKeys = (values: string[] | undefined) => {
  const bare: string[] = []
  const other: string[] = []

  for (const raw of values ?? []) {
    const trimmed = raw.trim()
    if (trimmed === '') continue
    const normalized = normalizePermissionToolName(trimmed)?.key ?? trimmed
    if (isBarePermissionKey(normalized)) {
      bare.push(normalized)
    } else {
      other.push(trimmed)
    }
  }

  return {
    bare: uniqueStrings(bare),
    other: uniqueStrings(other)
  }
}

export const resolvePermissionMirrorPath = (cwd: string, adapter: string, sessionId: string) => (
  resolveProjectAiPath(cwd, undefined, '.mock', 'permission-state', adapter, `${sessionId}.json`)
)
