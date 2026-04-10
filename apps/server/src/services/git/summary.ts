import type { GitChangeSummary, GitHeadCommitSummary } from '@vibe-forge/types'

import { parseGitHeadCommit, parseGitNumstat, summarizeGitNumstat } from './parsers'
import { resolveGitErrorMessage, runGit } from './runner'

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

export const getRepositoryChangeSummaries = async (repositoryRoot: string): Promise<{
  stagedSummary: GitChangeSummary
  workingTreeSummary: GitChangeSummary
}> => {
  const [stagedNumstat, unstagedNumstat, untrackedEntries] = await Promise.all([
    runGit(['diff', '--cached', '--numstat'], repositoryRoot),
    runGit(['diff', '--numstat'], repositoryRoot),
    getUntrackedNumstatEntries(repositoryRoot)
  ])

  const stagedEntries = parseGitNumstat(stagedNumstat.stdout)
  const unstagedEntries = parseGitNumstat(unstagedNumstat.stdout)

  return {
    stagedSummary: summarizeGitNumstat(stagedEntries),
    workingTreeSummary: summarizeGitNumstat([
      ...stagedEntries,
      ...unstagedEntries,
      ...untrackedEntries
    ])
  }
}

const isMissingHeadError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = resolveGitErrorMessage(error, '')
  return /does not have any commits yet/i.test(message) || /ambiguous argument 'HEAD'/i.test(message)
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
