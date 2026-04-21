export interface ParsedSemver {
  major: number
  minor: number
  patch: number
  prerelease?: string
}

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export const parseSemverVersion = (value: string | undefined): ParsedSemver | undefined => {
  const match = value?.trim().match(SEMVER_PATTERN)
  if (match == null) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    ...(match[4] != null ? { prerelease: match[4] } : {})
  }
}

export const areSemverVersionsCompatible = (
  clientVersion: string | undefined,
  serverVersion: string | undefined
) => {
  const client = parseSemverVersion(clientVersion)
  const server = parseSemverVersion(serverVersion)
  if (client == null || server == null) return false
  if (client.prerelease != null || server.prerelease != null) {
    return client.major === server.major &&
      client.minor === server.minor &&
      client.patch === server.patch &&
      client.prerelease === server.prerelease
  }
  if (client.major !== server.major) return false
  if (client.major === 0) return client.minor === server.minor
  return true
}
