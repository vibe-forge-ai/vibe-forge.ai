import { describe, expect, it } from 'vitest'

import { areSemverVersionsCompatible, parseSemverVersion } from '#~/version-compatibility'

describe('version compatibility', () => {
  it('parses semantic versions with optional v prefix and prerelease', () => {
    expect(parseSemverVersion('v1.2.3-beta.1')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: 'beta.1'
    })
  })

  it('allows stable versions within the same non-zero major version', () => {
    expect(areSemverVersionsCompatible('1.2.0', '1.9.3')).toBe(true)
    expect(areSemverVersionsCompatible('1.2.0', '2.0.0')).toBe(false)
  })

  it('requires matching minor versions while major is zero', () => {
    expect(areSemverVersionsCompatible('0.2.1', '0.2.9')).toBe(true)
    expect(areSemverVersionsCompatible('0.2.1', '0.3.0')).toBe(false)
  })

  it('requires exact prerelease identifiers for prerelease builds', () => {
    expect(areSemverVersionsCompatible('1.0.0-beta.1', '1.0.0-beta.1')).toBe(true)
    expect(areSemverVersionsCompatible('1.0.0-beta.1', '1.0.0')).toBe(false)
    expect(areSemverVersionsCompatible('1.0.0-beta.1', '1.0.0-beta.2')).toBe(false)
  })
})
