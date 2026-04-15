export const CANONICAL_VIBE_FORGE_MCP_SERVER_NAME = 'VibeForge'
export const LEGACY_VIBE_FORGE_MCP_PERMISSION_SERVER_KEY = 'vibe-forge'
export const CURRENT_VIBE_FORGE_MCP_PERMISSION_SERVER_KEY = 'vibeforge'

export const isCanonicalVibeForgeMcpServerName = (value: string | undefined) =>
  value?.trim() === CANONICAL_VIBE_FORGE_MCP_SERVER_NAME

export const sanitizeMcpPermissionKeySegment = (value: string | undefined) => {
  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') return undefined

  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized !== '' ? normalized : undefined
}

export const resolveMcpPermissionServerKeys = (value: string | undefined) => {
  if (isCanonicalVibeForgeMcpServerName(value)) {
    return [
      LEGACY_VIBE_FORGE_MCP_PERMISSION_SERVER_KEY,
      CURRENT_VIBE_FORGE_MCP_PERMISSION_SERVER_KEY
    ]
  }

  const key = sanitizeMcpPermissionKeySegment(value)
  return key != null ? [key] : []
}

export const resolveMcpPermissionServerKey = (value: string | undefined) => (
  resolveMcpPermissionServerKeys(value)[0]
)
