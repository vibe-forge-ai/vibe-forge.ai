import type { GitBranchSummary, GitChangeSummary, GitHeadCommitSummary } from '@vibe-forge/types'

export interface ParsedGitStatus {
  currentBranch: string | null
  upstream: string | null
  ahead: number
  behind: number
  hasChanges: boolean
  hasStagedChanges: boolean
  hasUnstagedChanges: boolean
  hasUntrackedChanges: boolean
}

export interface ParsedGitNumstatEntry {
  path: string
  additions: number
  deletions: number
}

export const parseGitStatus = (output: string): ParsedGitStatus => {
  let currentBranch: string | null = null
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  let hasStagedChanges = false
  let hasUnstagedChanges = false
  let hasUntrackedChanges = false

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') {
      continue
    }

    if (line.startsWith('# branch.head ')) {
      const value = line.slice('# branch.head '.length).trim()
      currentBranch = value === '(detached)' ? null : value
      continue
    }

    if (line.startsWith('# branch.upstream ')) {
      const value = line.slice('# branch.upstream '.length).trim()
      upstream = value === '' ? null : value
      continue
    }

    if (line.startsWith('# branch.ab ')) {
      const items = line.slice('# branch.ab '.length).trim().split(/\s+/)
      for (const item of items) {
        if (item.startsWith('+')) {
          ahead = Number.parseInt(item.slice(1), 10) || 0
        } else if (item.startsWith('-')) {
          behind = Number.parseInt(item.slice(1), 10) || 0
        }
      }
      continue
    }

    if (line.startsWith('? ')) {
      hasUntrackedChanges = true
      continue
    }

    if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ')) {
      const [, xy = '..'] = line.split(/\s+/, 3)
      const indexState = xy.at(0) ?? '.'
      const worktreeState = xy.at(1) ?? '.'
      if (indexState !== '.') {
        hasStagedChanges = true
      }
      if (worktreeState !== '.') {
        hasUnstagedChanges = true
      }
    }
  }

  return {
    currentBranch,
    upstream,
    ahead,
    behind,
    hasChanges: hasStagedChanges || hasUnstagedChanges || hasUntrackedChanges,
    hasStagedChanges,
    hasUnstagedChanges,
    hasUntrackedChanges
  }
}

export const parseGitBranches = (output: string, currentBranch: string | null): GitBranchSummary[] => {
  const branches: GitBranchSummary[] = []

  for (const rawLine of output.split(/\r?\n/)) {
    if (rawLine.trim() === '') {
      continue
    }

    const [name = '', fullRef = '', worktreePathRaw = ''] = rawLine.split('\t')
    const worktreePath = worktreePathRaw.trim() === '' ? undefined : worktreePathRaw.trim()
    if (fullRef.startsWith('refs/heads/')) {
      branches.push({
        name,
        kind: 'local',
        localName: name,
        worktreePath,
        isCurrent: name === currentBranch
      })
      continue
    }

    if (!fullRef.startsWith('refs/remotes/') || name.endsWith('/HEAD')) {
      continue
    }

    const [remoteName, ...rest] = name.split('/')
    const localName = rest.join('/')
    if (remoteName === '' || localName === '') {
      continue
    }

    branches.push({
      name,
      kind: 'remote',
      remoteName,
      localName,
      isCurrent: false
    })
  }

  branches.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'local' ? -1 : 1
    }
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1
    }
    if (left.kind === 'local' && right.kind === 'local') {
      const leftCheckedOut = left.worktreePath != null && left.worktreePath !== ''
      const rightCheckedOut = right.worktreePath != null && right.worktreePath !== ''
      if (leftCheckedOut !== rightCheckedOut) {
        return leftCheckedOut ? 1 : -1
      }
    }
    return left.name.localeCompare(right.name)
  })

  return branches
}
export const parseGitNumstat = (output: string): ParsedGitNumstatEntry[] => {
  const entries: ParsedGitNumstatEntry[] = []

  for (const rawLine of output.split(/\r?\n/)) {
    if (rawLine.trim() === '') {
      continue
    }

    const [additionsText = '', deletionsText = '', ...pathParts] = rawLine.split('\t')
    const path = pathParts.at(-1)?.trim() ?? ''
    if (path === '') {
      continue
    }

    entries.push({
      path,
      additions: additionsText === '-' ? 0 : Number.parseInt(additionsText, 10) || 0,
      deletions: deletionsText === '-' ? 0 : Number.parseInt(deletionsText, 10) || 0
    })
  }

  return entries
}

export const summarizeGitNumstat = (entries: ParsedGitNumstatEntry[]): GitChangeSummary => {
  const summaryByPath = new Map<string, { additions: number; deletions: number }>()

  for (const entry of entries) {
    const existing = summaryByPath.get(entry.path) ?? { additions: 0, deletions: 0 }
    existing.additions += entry.additions
    existing.deletions += entry.deletions
    summaryByPath.set(entry.path, existing)
  }

  return {
    changedFiles: summaryByPath.size,
    additions: Array.from(summaryByPath.values()).reduce((count, entry) => count + entry.additions, 0),
    deletions: Array.from(summaryByPath.values()).reduce((count, entry) => count + entry.deletions, 0)
  }
}

export const parseGitHeadCommit = (output: string): GitHeadCommitSummary | null => {
  const [hash = '', subject = ''] = output.split('\t')
  if (hash.trim() === '' || subject.trim() === '') {
    return null
  }

  return { hash, shortHash: hash.slice(0, 7), subject }
}
