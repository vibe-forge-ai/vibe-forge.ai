import { describe, expect, it } from 'vitest'

import { resolveDevDocumentTitle } from '#~/runtime-config'

describe('resolveDevDocumentTitle', () => {
  it('keeps the base title in production', () => {
    expect(resolveDevDocumentTitle('Vibe Forge Web', {
      isDev: false,
      gitRef: 'codex/feature-a'
    })).toBe('Vibe Forge Web')
  })

  it('appends the git ref in development', () => {
    expect(resolveDevDocumentTitle('Vibe Forge Web', {
      isDev: true,
      gitRef: 'codex/feature-a'
    })).toBe('Vibe Forge Web [codex/feature-a]')
  })

  it('falls back to the base title when the git ref is empty', () => {
    expect(resolveDevDocumentTitle('Vibe Forge Web', {
      isDev: true,
      gitRef: '   '
    })).toBe('Vibe Forge Web')
  })

  it('replaces an existing trailing dev suffix instead of duplicating it', () => {
    expect(resolveDevDocumentTitle('Vibe Forge Web [old-branch]', {
      isDev: true,
      gitRef: 'codex/feature-a'
    })).toBe('Vibe Forge Web [codex/feature-a]')
  })
})
