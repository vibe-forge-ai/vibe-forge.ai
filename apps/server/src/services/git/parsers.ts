import type { GitBranchSummary } from '@vibe-forge/types'

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

    const [name = '', fullRef = ''] = rawLine.split('\t')
    if (fullRef.startsWith('refs/heads/')) {
      branches.push({
        name,
        kind: 'local',
        localName: name,
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
    return left.name.localeCompare(right.name)
  })

  return branches
}
