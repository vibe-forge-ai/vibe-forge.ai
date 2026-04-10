import type { GitCommitPayload, GitRepositoryState } from '@vibe-forge/types'

import { badRequest, conflict } from '#~/utils/http.js'

import { ensureRepositoryContext, getSessionGitStateInternal } from './repository'
import { resolveGitErrorMessage, runGit } from './runner'

export const assertBranchName = async (name: string, repositoryRoot: string) => {
  const normalized = name.trim()
  if (normalized === '') {
    throw badRequest('Branch name is required', { name }, 'git_branch_name_required')
  }

  try {
    await runGit(['check-ref-format', '--branch', normalized], repositoryRoot)
  } catch (error) {
    throw badRequest(
      resolveGitErrorMessage(error, 'Invalid git branch name'),
      { name: normalized },
      'git_invalid_branch_name'
    )
  }

  return normalized
}

export const commitSessionGitChanges = async (
  sessionId: string,
  input: GitCommitPayload
): Promise<GitRepositoryState> => {
  const repo = await ensureRepositoryContext(sessionId)
  const trimmedMessage = input.message?.trim() ?? ''
  const includeUnstagedChanges = input.includeUnstagedChanges !== false
  const amend = input.amend === true
  const skipHooks = input.skipHooks === true

  if (trimmedMessage === '' && !amend) {
    throw badRequest('Commit message is required', undefined, 'git_commit_message_required')
  }

  const status = await getSessionGitStateInternal(sessionId)
  const hasCommitChanges = includeUnstagedChanges ? status.hasChanges === true : status.hasStagedChanges === true
  const hasAmendPayload = hasCommitChanges || trimmedMessage !== ''
  if (!hasCommitChanges && !amend) {
    throw conflict(
      includeUnstagedChanges
        ? 'There are no git changes to commit'
        : 'There are no staged git changes to commit',
      { sessionId },
      'git_no_changes_to_commit'
    )
  }
  if (amend && status.headCommit != null && !hasAmendPayload) {
    throw conflict(
      includeUnstagedChanges
        ? 'There are no git changes or message to amend'
        : 'There are no staged git changes or message to amend',
      { sessionId },
      'git_no_changes_to_commit'
    )
  }

  try {
    if (includeUnstagedChanges && status.hasChanges === true) {
      await runGit(['add', '-A'], repo.repositoryRoot)
    }

    const args = ['commit']
    if (amend) {
      args.push('--amend')
    }
    if (skipHooks) {
      args.push('--no-verify')
    }
    if (trimmedMessage !== '') {
      args.push('-m', trimmedMessage)
    } else if (amend) {
      args.push('--no-edit')
    }

    await runGit(args, repo.repositoryRoot)
  } catch (error) {
    throw conflict(
      resolveGitErrorMessage(error, 'Failed to commit git changes'),
      { cwd: repo.repositoryRoot },
      'git_commit_failed'
    )
  }

  return getSessionGitStateInternal(sessionId)
}
