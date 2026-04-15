export const CANONICAL_VIBE_FORGE_MCP_SERVER_NAME = 'VibeForge'
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
