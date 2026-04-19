import { afterEach, describe, expect, it } from 'vitest'

import { getServerHostEnv, resolveDevDocumentTitle } from '#~/runtime-config'

const getGlobalScope = () => (
  globalThis as { __VF_PROJECT_AI_RUNTIME_ENV__?: { __VF_PROJECT_AI_SERVER_HOST__: string } }
)

const setRuntimeServerHost = (host: string) => {
  getGlobalScope().__VF_PROJECT_AI_RUNTIME_ENV__ = {
    __VF_PROJECT_AI_SERVER_HOST__: host
  }
}

const clearRuntimeEnv = () => {
  delete getGlobalScope().__VF_PROJECT_AI_RUNTIME_ENV__
}

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

describe('getServerHostEnv', () => {
  afterEach(() => {
    clearRuntimeEnv()
  })

  it('ignores unspecified listen addresses for browser requests', () => {
    for (const host of ['0.0.0.0', '::', '[::]', '   ']) {
      setRuntimeServerHost(host)
      expect(getServerHostEnv()).toBeUndefined()
    }
  })

  it('returns a concrete runtime host', () => {
    setRuntimeServerHost(' 192.168.31.125 ')
    expect(getServerHostEnv()).toBe('192.168.31.125')
  })
})
