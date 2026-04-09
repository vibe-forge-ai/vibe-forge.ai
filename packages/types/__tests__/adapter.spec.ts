import { describe, expect, it } from 'vitest'

import { normalizeAdapterPackageId, resolveAdapterPackageName } from '@vibe-forge/types'

describe('adapter package helpers', () => {
  it('maps claude adapter aliases to the claude-code package', () => {
    expect(normalizeAdapterPackageId('claude')).toBe('claude-code')
    expect(normalizeAdapterPackageId('adapter-claude')).toBe('adapter-claude-code')
    expect(resolveAdapterPackageName('claude')).toBe('@vibe-forge/adapter-claude-code')
    expect(resolveAdapterPackageName('adapter-claude')).toBe('@vibe-forge/adapter-claude-code')
  })

  it('keeps other adapter ids unchanged', () => {
    expect(normalizeAdapterPackageId('codex')).toBe('codex')
    expect(normalizeAdapterPackageId('adapter-codex')).toBe('adapter-codex')
    expect(resolveAdapterPackageName('codex')).toBe('@vibe-forge/adapter-codex')
    expect(resolveAdapterPackageName('adapter-codex')).toBe('@vibe-forge/adapter-codex')
    expect(resolveAdapterPackageName('@scope/custom-adapter')).toBe('@scope/custom-adapter')
  })
})
