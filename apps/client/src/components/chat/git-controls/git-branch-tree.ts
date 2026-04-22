import type { GitBranchSummary } from '@vibe-forge/types'

export type GitBranchDisplayMode = 'flat' | 'tree'

export interface GitBranchTreeFolder {
  entries: GitBranchTreeEntry[]
  hasCurrentBranch: boolean
  key: string
  label: string
}

export type GitBranchTreeEntry =
  | {
    type: 'branch'
    branch: GitBranchSummary
    label: string
    subtitle?: string
  }
  | {
    type: 'folder'
    folder: GitBranchTreeFolder
  }

interface BranchTreeDraftFolder {
  branches: GitBranchSummary[]
  children: Map<string, BranchTreeDraftFolder>
  hasCurrentBranch: boolean
  key: string
  label: string
}

const createDraftFolder = (key: string, label: string): BranchTreeDraftFolder => ({
  branches: [],
  children: new Map(),
  hasCurrentBranch: false,
  key,
  label
})

const getBranchSegments = (branch: GitBranchSummary) => (
  branch.kind === 'remote'
    ? [branch.remoteName ?? 'remote', ...branch.localName.split('/').filter(Boolean)]
    : branch.name.split('/').filter(Boolean)
)

export const getGitBranchTreeLabel = (branch: GitBranchSummary) => {
  const segments = getBranchSegments(branch)
  return segments.at(-1) ?? branch.localName ?? branch.name
}

const sortBranchEntries = (left: GitBranchSummary, right: GitBranchSummary) => {
  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1
  }

  return getGitBranchTreeLabel(left).localeCompare(getGitBranchTreeLabel(right))
}

const finalizeDraftFolder = (folder: BranchTreeDraftFolder): GitBranchTreeFolder => {
  const folderEntries = Array.from(folder.children.values())
    .sort((left, right) => {
      if (left.hasCurrentBranch !== right.hasCurrentBranch) {
        return left.hasCurrentBranch ? -1 : 1
      }

      return left.label.localeCompare(right.label)
    })
    .map(child => ({
      type: 'folder' as const,
      folder: finalizeDraftFolder(child)
    }))

  const branchEntries = [...folder.branches]
    .sort(sortBranchEntries)
    .map(branch => ({
      type: 'branch' as const,
      branch,
      label: getGitBranchTreeLabel(branch)
    }))

  return {
    entries: [...folderEntries, ...branchEntries],
    hasCurrentBranch: folder.hasCurrentBranch,
    key: folder.key,
    label: folder.label
  }
}

export const buildGitBranchTree = (branches: GitBranchSummary[], keyPrefix = '') => {
  const root = createDraftFolder(keyPrefix, 'root')

  for (const branch of branches) {
    const segments = getBranchSegments(branch)
    const leafLabel = segments.pop()
    const branchIsCurrent = branch.isCurrent === true
    const pathParts = keyPrefix === '' ? [] : [keyPrefix]
    root.hasCurrentBranch = root.hasCurrentBranch || branchIsCurrent
    if (leafLabel == null || leafLabel.trim() === '') {
      root.branches.push(branch)
      continue
    }

    let cursor = root
    for (const segment of segments) {
      pathParts.push(segment)
      const existing = cursor.children.get(segment)
      if (existing != null) {
        cursor = existing
        cursor.hasCurrentBranch = cursor.hasCurrentBranch || branchIsCurrent
        continue
      }

      const nextFolder = createDraftFolder(pathParts.join('/'), segment)
      nextFolder.hasCurrentBranch = branchIsCurrent
      cursor.children.set(segment, nextFolder)
      cursor = nextFolder
    }

    cursor.hasCurrentBranch = cursor.hasCurrentBranch || branchIsCurrent
    cursor.branches.push(branch)
  }

  return finalizeDraftFolder(root).entries
}

export const collectGitBranchTreeFolderKeys = (entries: GitBranchTreeEntry[]): string[] => {
  return entries.flatMap(entry => {
    if (entry.type !== 'folder') {
      return []
    }

    return [entry.folder.key, ...collectGitBranchTreeFolderKeys(entry.folder.entries)]
  })
}

export const getGitBranchTreeFolderKeysForBranch = (branch: GitBranchSummary, keyPrefix = '') => {
  const segments = getBranchSegments(branch)
  segments.pop()

  const folderKeys = keyPrefix === '' ? [] : [keyPrefix]
  const pathParts = keyPrefix === '' ? [] : [keyPrefix]
  for (const segment of segments) {
    pathParts.push(segment)
    folderKeys.push(pathParts.join('/'))
  }

  return folderKeys
}
