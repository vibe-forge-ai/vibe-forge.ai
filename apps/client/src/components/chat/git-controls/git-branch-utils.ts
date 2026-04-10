import type { GitBranchSummary } from '@vibe-forge/types'

const normalizeBranchText = (value: string) => value.trim().toLowerCase()

const getBranchSearchTokens = (branch: GitBranchSummary) => {
  const tokens = [branch.name, branch.localName]
  if (branch.remoteName != null && branch.remoteName !== '') {
    tokens.push(branch.remoteName, `${branch.remoteName}/${branch.localName}`)
  }
  return tokens.map(token => normalizeBranchText(token))
}

export const filterGitBranches = (branches: GitBranchSummary[], query: string) => {
  const normalizedQuery = normalizeBranchText(query)
  if (normalizedQuery === '') {
    return branches
  }

  return branches.filter(branch => getBranchSearchTokens(branch).some(token => token.includes(normalizedQuery)))
}

export const hasExactGitBranchMatch = (branches: GitBranchSummary[], query: string) => {
  const normalizedQuery = normalizeBranchText(query)
  if (normalizedQuery === '') {
    return false
  }

  return branches.some(branch => getBranchSearchTokens(branch).includes(normalizedQuery))
}
