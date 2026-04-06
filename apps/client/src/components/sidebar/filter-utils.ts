const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildWildcardRegex = (pattern: string) => {
  return new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`, 'i')
}

const matchesPattern = (candidate: string, pattern: string) => {
  const normalizedCandidate = candidate.trim()
  const normalizedPattern = pattern.trim()

  if (normalizedCandidate === '' || normalizedPattern === '') return false
  if (normalizedPattern.includes('*')) {
    return buildWildcardRegex(normalizedPattern).test(normalizedCandidate)
  }

  return normalizedCandidate.toLowerCase().includes(normalizedPattern.toLowerCase())
}

export const matchesAnyFilterPattern = (candidates: string[], patterns: string[]) => {
  if (patterns.length === 0) return true

  return patterns.some((pattern) => candidates.some((candidate) => matchesPattern(candidate, pattern)))
}
