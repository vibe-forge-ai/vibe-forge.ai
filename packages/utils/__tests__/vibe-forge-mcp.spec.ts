import { describe, expect, it } from 'vitest'

import {
  CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
  isCanonicalVibeForgeMcpServerName,
  sanitizeMcpPermissionKeySegment
} from '#~/index.js'

describe('vibe-forge mcp naming helpers', () => {
  it('exposes VibeForge as the canonical built-in MCP server name', () => {
    expect(CANONICAL_VIBE_FORGE_MCP_SERVER_NAME).toBe('VibeForge')
    expect(isCanonicalVibeForgeMcpServerName('VibeForge')).toBe(true)
    expect(isCanonicalVibeForgeMcpServerName('vibe-forge')).toBe(false)
  })

  it('sanitizes the canonical name directly for permission subject keys', () => {
    expect(sanitizeMcpPermissionKeySegment('VibeForge')).toBe('vibeforge')
    expect(sanitizeMcpPermissionKeySegment('List Tasks')).toBe('list-tasks')
  })
})
