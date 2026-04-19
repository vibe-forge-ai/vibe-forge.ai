import type { SessionWorkspaceFileState } from '@vibe-forge/core'

const uniqueNonEmptyStrings = (values: unknown[]) => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export const normalizeSessionWorkspaceFileState = (value: unknown): SessionWorkspaceFileState => {
  const input = value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<SessionWorkspaceFileState>
    : {}
  const selectedPath = typeof input.selectedPath === 'string' && input.selectedPath.trim() !== ''
    ? input.selectedPath.trim()
    : undefined
  const openPaths = uniqueNonEmptyStrings([
    ...(Array.isArray(input.openPaths) ? input.openPaths : []),
    ...(selectedPath == null ? [] : [selectedPath])
  ])
  const normalizedSelectedPath = selectedPath != null && openPaths.includes(selectedPath)
    ? selectedPath
    : openPaths.at(0)
  const isOpen = input.isOpen === true && normalizedSelectedPath != null
  return {
    openPaths,
    ...(normalizedSelectedPath == null ? {} : { selectedPath: normalizedSelectedPath }),
    isOpen
  }
}

export const parseSessionWorkspaceFileState = (value: string | null): SessionWorkspaceFileState | undefined => {
  if (value == null || value.trim() === '') {
    return undefined
  }

  try {
    return normalizeSessionWorkspaceFileState(JSON.parse(value))
  } catch {
    return undefined
  }
}
