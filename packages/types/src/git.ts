export type GitAvailabilityReason =
  | 'cwd_missing'
  | 'git_not_installed'
  | 'not_repository'

export type GitBranchKind = 'local' | 'remote'

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
}

export interface GitBranchSummary {
  name: string
  kind: GitBranchKind
  localName: string
  remoteName?: string
  isCurrent: boolean
}

export interface GitBranchListResult {
  currentBranch: string | null
  branches: GitBranchSummary[]
}

export interface GitMutationResult {
  repo: GitRepositoryState
}
