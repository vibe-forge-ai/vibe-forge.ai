import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { GitBranchSummary, GitRepositoryState } from '@vibe-forge/types'

import { getWorkspaceGitState, listWorkspaceGitBranches, listWorkspaceGitWorktrees } from '#~/api'
import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'

import {
  filterGitBranches,
  getGitBranchCheckoutBlockedPath,
  getGitBranchViewState,
  hasExactGitBranchMatch
} from './git-branch-utils'
import { getGitControlState } from './git-operation-utils'
import { getGitWorktreeViewState } from './git-worktree-utils'

const EMPTY_REPO_STATE: GitRepositoryState = {
  available: false,
  cwd: ''
}

export function useChatDraftGitControls({
  draft,
  onChange
}: {
  draft: ChatSessionWorkspaceDraft
  onChange: (nextDraft: ChatSessionWorkspaceDraft) => void
}) {
  const { t } = useTranslation()
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [worktreeMenuOpen, setWorktreeMenuOpen] = useState(false)
  const [shouldLoadBranches, setShouldLoadBranches] = useState(false)
  const [branchQuery, setBranchQuery] = useState('')

  const { data: repoState } = useSWR<GitRepositoryState>(
    'workspace-git-state',
    () => getWorkspaceGitState(),
    { revalidateOnFocus: false }
  )
  const { data: branchData, isLoading: isBranchListLoading } = useSWR(
    shouldLoadBranches ? 'workspace-git-branches' : null,
    () => listWorkspaceGitBranches(),
    { revalidateOnFocus: false }
  )
  const { data: worktreeData } = useSWR(
    repoState?.available === true ? 'workspace-git-worktrees' : null,
    () => listWorkspaceGitWorktrees(),
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (!branchMenuOpen) {
      setBranchQuery('')
    }
  }, [branchMenuOpen])

  const allBranches = branchData?.branches ?? []
  const filteredBranches = useMemo(() => filterGitBranches(allBranches, branchQuery), [allBranches, branchQuery])
  const currentWorktreePath = draft.createWorktree ? '' : repoState?.repositoryRoot ?? ''
  const { availableLocalBranches, hasResults: hasBranchResults, remoteBranches } = useMemo(
    () => getGitBranchViewState(filteredBranches, allBranches, currentWorktreePath),
    [allBranches, currentWorktreePath, filteredBranches]
  )
  const canCreateBranch = branchQuery.trim() !== '' && !hasExactGitBranchMatch(allBranches, branchQuery)
  const worktreeViewState = useMemo(() =>
    getGitWorktreeViewState({
      currentBranch: repoState?.currentBranch,
      enabled: repoState?.available === true,
      repositoryRoot: repoState?.repositoryRoot,
      worktrees: worktreeData?.worktrees
    }), [repoState?.available, repoState?.currentBranch, repoState?.repositoryRoot, worktreeData?.worktrees])
  const { currentBranchLabel: repoBranchLabel } = getGitControlState(repoState, false, {
    detachedHead: t('chat.gitDetachedHead'),
    pushNeedsSyncOrForce: t('chat.gitPushNeedsSyncOrForce'),
    pushUnavailable: t('common.operationFailed')
  })

  const currentBranchLabel = draft.branch == null
    ? repoBranchLabel
    : draft.branch.mode === 'create'
    ? t('chat.sessionWorkspaceDraftCreateBranchLabel', { branch: draft.branch.name })
    : draft.branch.name

  const handleDraftChange = (nextDraft: ChatSessionWorkspaceDraft) => {
    onChange(nextDraft)
  }

  const handleBranchSwitch = (branch: GitBranchSummary) => {
    handleDraftChange({
      ...draft,
      branch: {
        mode: 'checkout',
        name: branch.name,
        kind: branch.kind
      }
    })
    setBranchMenuOpen(false)
  }

  const handleCreateBranch = (name: string) => {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      return
    }

    handleDraftChange({
      ...draft,
      branch: {
        mode: 'create',
        name: trimmedName
      }
    })
    setBranchMenuOpen(false)
  }

  const handleCreateWorktreeChange = (checked: boolean) => {
    if (draft.branch == null || draft.branch.mode === 'create') {
      handleDraftChange({
        ...draft,
        createWorktree: checked
      })
      return
    }

    const selectedBranch = allBranches.find(branch =>
      branch.kind === draft.branch?.kind && branch.name === draft.branch?.name
    )
    if (selectedBranch == null) {
      handleDraftChange({
        ...draft,
        createWorktree: checked
      })
      return
    }

    const nextCurrentWorktreePath = checked ? '' : repoState?.repositoryRoot ?? ''
    const blockedPath = getGitBranchCheckoutBlockedPath(selectedBranch, allBranches, nextCurrentWorktreePath)
    handleDraftChange({
      ...draft,
      createWorktree: checked,
      branch: blockedPath == null ? draft.branch : undefined
    })
  }

  return {
    availableLocalBranches,
    branchMenuOpen,
    branchQuery,
    canCreateBranch,
    currentBranchLabel,
    handleBranchSwitch,
    handleCreateBranch,
    handleCreateWorktreeChange,
    hasBranchResults,
    isBranchListLoading,
    repoState: repoState ?? EMPTY_REPO_STATE,
    remoteBranches,
    setBranchMenuOpen,
    setBranchQuery,
    setShouldLoadBranches,
    setWorktreeMenuOpen,
    shouldLoadBranches,
    worktreeMenuOpen,
    worktrees: worktreeViewState.worktrees
  }
}
