import type { GitBranchSummary } from '@vibe-forge/types'

const normalizeWorktreePath = (value: string) => value.replace(/[\\/]+$/, '')

export const getBlockedGitWorktreePath = (
  target: GitBranchSummary,
  branches: GitBranchSummary[],
  currentWorktreePath: string
) => {
  const normalizedCurrentWorktreePath = normalizeWorktreePath(currentWorktreePath)

  if (target.kind === 'local') {
    if (target.worktreePath == null || target.worktreePath.trim() === '') {
      return null
    }

    const normalizedTargetWorktreePath = normalizeWorktreePath(target.worktreePath.trim())
    return normalizedTargetWorktreePath === normalizedCurrentWorktreePath ? null : target.worktreePath.trim()
  }

  const localPeer = branches.find(branch => branch.kind === 'local' && branch.localName === target.localName)
  if (localPeer?.worktreePath == null || localPeer.worktreePath.trim() === '') {
    return null
  }

  const normalizedPeerWorktreePath = normalizeWorktreePath(localPeer.worktreePath.trim())
  return normalizedPeerWorktreePath === normalizedCurrentWorktreePath ? null : localPeer.worktreePath.trim()
}
