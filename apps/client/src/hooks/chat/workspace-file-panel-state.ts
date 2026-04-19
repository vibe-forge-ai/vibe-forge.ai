import type { SessionWorkspaceFileState } from '@vibe-forge/core'

export interface WorkspaceFilePanelState {
  openPaths: string[]
  selectedPath: string | null
  isOpen: boolean
}

export const uniqueNonEmptyPaths = (paths: Array<string | null | undefined>) => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    const trimmed = path?.trim()
    if (trimmed == null || trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export const normalizeWorkspaceFileState = (
  state: SessionWorkspaceFileState | WorkspaceFilePanelState | undefined
): WorkspaceFilePanelState => {
  const selectedPath = state?.selectedPath?.trim() || null
  const openPaths = uniqueNonEmptyPaths([
    ...(state?.openPaths ?? []),
    selectedPath
  ])
  const normalizedSelectedPath = selectedPath != null && openPaths.includes(selectedPath)
    ? selectedPath
    : openPaths.at(0) ?? null
  return {
    openPaths,
    selectedPath: normalizedSelectedPath,
    isOpen: state?.isOpen === true && normalizedSelectedPath != null
  }
}

export const toSessionWorkspaceFileState = (state: WorkspaceFilePanelState): SessionWorkspaceFileState => ({
  openPaths: state.openPaths,
  ...(state.selectedPath == null ? {} : { selectedPath: state.selectedPath }),
  isOpen: state.isOpen
})
