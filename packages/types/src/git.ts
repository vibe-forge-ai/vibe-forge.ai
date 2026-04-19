export type GitAvailabilityReason =
  | 'cwd_missing'
  | 'git_not_installed'
  | 'not_repository'

export type GitBranchKind = 'local' | 'remote'

export interface GitChangeSummary {
  changedFiles: number
  additions: number
  deletions: number
}

export interface GitSubmoduleChange {
  commitChanged: boolean
  trackedChanges: boolean
  untrackedChanges: boolean
}

export interface GitChangedFile {
  path: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
  submodule?: GitSubmoduleChange
}

export interface GitHeadCommitSummary {
  hash: string
  shortHash: string
  subject: string
}

export interface GitRepositoryState {
  available: boolean
  cwd: string
  repositoryRoot?: string
  reason?: GitAvailabilityReason
  currentBranch?: string | null
  upstream?: string | null
  ahead?: number
  behind?: number
  hasChanges?: boolean
  hasStagedChanges?: boolean
  hasUnstagedChanges?: boolean
  hasUntrackedChanges?: boolean
  remotes?: string[]
  changedFiles?: GitChangedFile[]
  stagedSummary?: GitChangeSummary
  workingTreeSummary?: GitChangeSummary
  headCommit?: GitHeadCommitSummary | null
}

export interface GitBranchSummary {
  name: string
  kind: GitBranchKind
  localName: string
  remoteName?: string
  worktreePath?: string
  isCurrent: boolean
}

export interface GitBranchListResult {
  currentBranch: string | null
  branches: GitBranchSummary[]
}

export interface GitWorktreeSummary {
  path: string
  branchName: string | null
  isCurrent: boolean
  isDetached: boolean
}

export interface GitWorktreeListResult {
  worktrees: GitWorktreeSummary[]
}

export interface GitMutationResult {
  repo: GitRepositoryState
}

export interface GitCommitPayload {
  message?: string
  includeUnstagedChanges?: boolean
  amend?: boolean
  skipHooks?: boolean
}

export interface GitPushPayload {
  force?: boolean
}
