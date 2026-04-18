import type { Config, WorkspaceConfigEntry } from '@vibe-forge/types'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const mergeRecord = <T>(
  left?: Record<string, T>,
  right?: Record<string, T>
) => {
  if (left == null && right == null) return undefined

  return {
    ...(left ?? {}),
    ...(right ?? {})
  }
}

const mergeUniqueList = <T>(
  left?: T[],
  right?: T[]
) => {
  if (left == null && right == null) return undefined
  return Array.from(
    new Set([
      ...(left ?? []),
      ...(right ?? [])
    ])
  )
}

const toStringList = (value: unknown): string[] | undefined => {
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()]
  }
  if (!Array.isArray(value)) return undefined

  const list = value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim())
  return list.length > 0 ? list : undefined
}

const normalizeWorkspaceConfigForMerge = (value: Config['workspaces'] | undefined) => {
  if (value == null) return undefined

  if (typeof value === 'string' || Array.isArray(value)) {
    return {
      include: toStringList(value)
    } satisfies NonNullable<Config['workspaces']>
  }

  if (!isRecord(value)) return undefined

  const include = mergeUniqueList(
    mergeUniqueList(toStringList(value.include), toStringList(value.glob)),
    toStringList(value.globs)
  )
  const exclude = toStringList(value.exclude)
  const entries = isRecord(value.entries)
    ? value.entries as Record<string, string | WorkspaceConfigEntry>
    : undefined

  return {
    ...(include == null ? {} : { include }),
    ...(exclude == null ? {} : { exclude }),
    ...(entries == null ? {} : { entries })
  } satisfies NonNullable<Config['workspaces']>
}

export const mergeWorkspaceConfigs = (
  left?: Config['workspaces'],
  right?: Config['workspaces']
) => {
  const leftConfig = normalizeWorkspaceConfigForMerge(left)
  const rightConfig = normalizeWorkspaceConfigForMerge(right)
  if (leftConfig == null && rightConfig == null) return undefined

  return {
    include: mergeUniqueList(
      toStringList((leftConfig as Record<string, unknown> | undefined)?.include),
      toStringList((rightConfig as Record<string, unknown> | undefined)?.include)
    ),
    exclude: mergeUniqueList(
      toStringList((leftConfig as Record<string, unknown> | undefined)?.exclude),
      toStringList((rightConfig as Record<string, unknown> | undefined)?.exclude)
    ),
    entries: mergeRecord(
      (leftConfig as Record<string, unknown> | undefined)?.entries as
        | Record<string, string | WorkspaceConfigEntry>
        | undefined,
      (rightConfig as Record<string, unknown> | undefined)?.entries as
        | Record<string, string | WorkspaceConfigEntry>
        | undefined
    )
  } satisfies NonNullable<Config['workspaces']>
}
