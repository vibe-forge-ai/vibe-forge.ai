import { stat } from 'node:fs/promises'

import type { Config, WorkspaceConfigEntry } from '@vibe-forge/types'
import { glob } from 'fast-glob'

const DEFAULT_WORKSPACE_IGNORES = [
  '**/.git/**',
  '**/.ai/**',
  '**/node_modules/**'
]

export interface NormalizedWorkspaceEntry {
  enabled?: boolean
  name?: string
  description?: string
  path?: string
  include?: string[]
  exclude?: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const toStringList = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()]
  }
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim())
}

const normalizeWorkspaceEntry = (
  id: string,
  value: string | WorkspaceConfigEntry
): NormalizedWorkspaceEntry | undefined => {
  if (typeof value === 'string') {
    return { path: value }
  }

  if (!isRecord(value)) return undefined
  const enabled = typeof value.enabled === 'boolean' ? value.enabled : undefined
  if (enabled === false) return { enabled: false }

  return {
    enabled,
    name: typeof value.name === 'string' && value.name.trim() !== '' ? value.name.trim() : id,
    description: typeof value.description === 'string' && value.description.trim() !== ''
      ? value.description.trim()
      : undefined,
    path: typeof value.path === 'string' && value.path.trim() !== '' ? value.path.trim() : undefined,
    include: [
      ...toStringList(value.include),
      ...toStringList(value.glob),
      ...toStringList(value.globs)
    ],
    exclude: toStringList(value.exclude)
  }
}

export const normalizeWorkspaceConfig = (config: Config['workspaces'] | undefined) => {
  if (config == null) {
    return {
      include: [] as string[],
      exclude: [] as string[],
      entries: {} as Record<string, NormalizedWorkspaceEntry>
    }
  }

  if (typeof config === 'string' || Array.isArray(config)) {
    return {
      include: toStringList(config),
      exclude: [] as string[],
      entries: {} as Record<string, NormalizedWorkspaceEntry>
    }
  }

  if (!isRecord(config)) {
    return {
      include: [] as string[],
      exclude: [] as string[],
      entries: {} as Record<string, NormalizedWorkspaceEntry>
    }
  }

  const entries = Object.fromEntries(
    Object.entries(config.entries ?? {})
      .map(([id, value]) => [id, normalizeWorkspaceEntry(id, value)])
      .filter((entry): entry is [string, NormalizedWorkspaceEntry] => entry[1] != null)
  )

  return {
    include: [
      ...toStringList(config.include),
      ...toStringList(config.glob),
      ...toStringList(config.globs)
    ],
    exclude: toStringList(config.exclude),
    entries
  }
}

export const isDirectory = async (path: string) => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

export const scanWorkspacePatterns = async (
  cwd: string,
  patterns: string[],
  exclude: string[]
) => {
  if (patterns.length === 0) return []

  return await glob(patterns, {
    cwd,
    absolute: true,
    onlyDirectories: true,
    unique: true,
    followSymbolicLinks: true,
    ignore: [
      ...DEFAULT_WORKSPACE_IGNORES,
      ...exclude
    ]
  })
}
