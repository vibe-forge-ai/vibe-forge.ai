import type { GitWorktreeSummary } from '@vibe-forge/types'

const normalizeWorktreePath = (value: string) => value.trim().replace(/[/\\]+$/, '').replace(/\\/g, '/')

export const parseGitWorktrees = (output: string, currentWorktreePath: string): GitWorktreeSummary[] => {
  const worktrees: GitWorktreeSummary[] = []
  const normalizedCurrentWorktreePath = normalizeWorktreePath(currentWorktreePath)
  let currentEntry: Partial<GitWorktreeSummary> | null = null

  const flushCurrentEntry = () => {
    if (currentEntry?.path == null || currentEntry.path.trim() === '') {
      currentEntry = null
      return
    }

    const path = currentEntry.path.trim()
    worktrees.push({
      path,
      branchName: currentEntry.branchName?.trim() || null,
      isCurrent: normalizeWorktreePath(path) === normalizedCurrentWorktreePath,
      isDetached: currentEntry.isDetached === true
    })
    currentEntry = null
  }

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') {
      flushCurrentEntry()
      continue
    }

    if (line.startsWith('worktree ')) {
      flushCurrentEntry()
      currentEntry = {
        path: line.slice('worktree '.length).trim(),
        branchName: null,
        isDetached: false
      }
      continue
    }

    if (currentEntry == null) {
      continue
    }

    if (line.startsWith('branch ')) {
      const branchRef = line.slice('branch '.length).trim()
      currentEntry.branchName = branchRef.startsWith('refs/heads/')
        ? branchRef.slice('refs/heads/'.length)
        : branchRef
      continue
    }

    if (line === 'detached') {
      currentEntry.isDetached = true
      currentEntry.branchName = null
    }
  }

  flushCurrentEntry()
  return worktrees
}
