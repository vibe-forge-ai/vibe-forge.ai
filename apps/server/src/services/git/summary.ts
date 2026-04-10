import type { GitChangeSummary, GitHeadCommitSummary } from '@vibe-forge/types'

import { parseGitHeadCommit, parseGitNumstat, summarizeGitNumstat } from './parsers'
import { resolveGitErrorMessage, runGit } from './runner'

const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const isMissingHeadError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = resolveGitErrorMessage(error, '')
  return /does not have any commits yet/i.test(message) || /ambiguous argument 'HEAD'/i.test(message)
}

const listUntrackedFiles = async (repositoryRoot: string) => {
  const { stdout } = await runGit(['ls-files', '--others', '--exclude-standard', '-z'], repositoryRoot)
  return stdout.split('\0').map(item => item.trim()).filter(Boolean)
}

const getUntrackedNumstatEntries = async (repositoryRoot: string) => {
  const files = await listUntrackedFiles(repositoryRoot)
  if (files.length === 0) {
    return []
  }

  // Do not read every untracked file to estimate line counts. That turns a
  // cheap status query into an O(total untracked file size) operation.
  return files.map(path => ({
    path,
    additions: 0,
    deletions: 0
  }))
}

const getWorkingTreeNumstatEntries = async (repositoryRoot: string) => {
  try {
    const { stdout } = await runGit(['diff', 'HEAD', '--numstat'], repositoryRoot)
    return parseGitNumstat(stdout)
  } catch (error) {
    if (!isMissingHeadError(error)) {
      throw error
    }

    const { stdout } = await runGit(['diff', EMPTY_TREE_HASH, '--numstat'], repositoryRoot)
    return parseGitNumstat(stdout)
  }
}

export const getRepositoryChangeSummaries = async (repositoryRoot: string): Promise<{
  stagedSummary: GitChangeSummary
  workingTreeSummary: GitChangeSummary
}> => {
  const [stagedNumstat, workingTreeEntries, untrackedEntries] = await Promise.all([
    runGit(['diff', '--cached', '--numstat'], repositoryRoot),
    getWorkingTreeNumstatEntries(repositoryRoot),
    getUntrackedNumstatEntries(repositoryRoot)
  ])

  const stagedEntries = parseGitNumstat(stagedNumstat.stdout)

  return {
    stagedSummary: summarizeGitNumstat(stagedEntries),
    workingTreeSummary: summarizeGitNumstat([
      ...workingTreeEntries,
      ...untrackedEntries
    ])
  }
}

export const getHeadCommitSummary = async (repositoryRoot: string): Promise<GitHeadCommitSummary | null> => {
  try {
    const { stdout } = await runGit(['log', '-1', '--pretty=format:%H\t%s'], repositoryRoot)
    return parseGitHeadCommit(stdout)
  } catch (error) {
    if (isMissingHeadError(error)) {
      return null
    }
    throw error
  }
}
