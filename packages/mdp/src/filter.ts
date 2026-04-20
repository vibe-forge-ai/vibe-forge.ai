import type { MdpClientSummary, MdpFilterConfig, MdpPathSummary } from '@vibe-forge/types'

const escapeRegex = (value: string) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')

const globToRegExp = (pattern: string) => (
  new RegExp(`^${Array.from(pattern).map((char) => {
    if (char === '*') return '.*'
    if (char === '?') return '.'
    return escapeRegex(char)
  }).join('')}$`, 'i')
)

const matchesAnyPattern = (value: string | undefined, patterns: string[]) => {
  if (value == null || value.trim() === '') return false
  return patterns.some(pattern => globToRegExp(pattern).test(value))
}

export const isVisibleMdpClient = (
  client: Pick<MdpClientSummary, 'clientId' | 'rawClientId' | 'name'>,
  filters: Required<MdpFilterConfig>
) => !(
  matchesAnyPattern(client.clientId, filters.excludeClientIds) ||
  matchesAnyPattern(client.rawClientId, filters.excludeClientIds) ||
  matchesAnyPattern(client.name, filters.excludeNames)
)

export const isVisibleMdpPath = (
  path: Pick<MdpPathSummary, 'path'>,
  client: Pick<MdpClientSummary, 'clientId' | 'rawClientId' | 'name'>,
  filters: Required<MdpFilterConfig>
) => (
  isVisibleMdpClient(client, filters) &&
  !matchesAnyPattern(path.path, filters.excludePaths)
)
