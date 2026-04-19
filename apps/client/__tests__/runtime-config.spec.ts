import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SERVER_BASE_URL_STORAGE_KEY,
  SERVER_CONNECTION_PICKER_STORAGE_KEY,
  clearServerConnectionPickerRequest,
  clearStoredServerBaseUrl,
  createServerUrl,
  getConfiguredServerBaseUrl,
  getServerBaseUrl,
  getServerHostEnv,
  isDesktopClientMode,
  isServerConnectionManagedClientMode,
  isServerConnectionPickerRequested,
  normalizeServerBaseUrl,
  requestServerConnectionPicker,
  resolveDevDocumentTitle,
  setStoredServerBaseUrl
} from '#~/runtime-config'

const getGlobalScope = () => (
  globalThis as {
    __VF_PROJECT_AI_RUNTIME_ENV__?: {
      __VF_PROJECT_AI_SERVER_BASE_URL__?: string
      __VF_PROJECT_AI_CLIENT_MODE__?: string
      __VF_PROJECT_AI_SERVER_HOST__?: string
      __VF_PROJECT_AI_SERVER_PORT__?: string
    }
  }
)

const setRuntimeServerHost = (host: string) => {
  getGlobalScope().__VF_PROJECT_AI_RUNTIME_ENV__ = {
    __VF_PROJECT_AI_SERVER_HOST__: host
  }
}

const clearRuntimeEnv = () => {
  delete getGlobalScope().__VF_PROJECT_AI_RUNTIME_ENV__
}

const setRuntimeEnv = (env: NonNullable<ReturnType<typeof getGlobalScope>['__VF_PROJECT_AI_RUNTIME_ENV__']>) => {
  getGlobalScope().__VF_PROJECT_AI_RUNTIME_ENV__ = env
}

const createStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
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
    clearStoredServerBaseUrl()
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

describe('server base URL helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
  })

  afterEach(() => {
    clearRuntimeEnv()
    clearStoredServerBaseUrl()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('normalizes backend addresses with optional paths', () => {
    expect(normalizeServerBaseUrl(' http://localhost:8787/ ')).toBe('http://localhost:8787')
    expect(normalizeServerBaseUrl('https://api.example.com/vf/')).toBe('https://api.example.com/vf')
    expect(normalizeServerBaseUrl('ftp://api.example.com')).toBeUndefined()
  })

  it('uses the stored backend address only in standalone client mode', () => {
    localStorage.setItem(SERVER_BASE_URL_STORAGE_KEY, 'https://standalone.example.com')
    setRuntimeEnv({
      __VF_PROJECT_AI_CLIENT_MODE__: 'standalone',
      __VF_PROJECT_AI_SERVER_HOST__: 'server.example.com',
      __VF_PROJECT_AI_SERVER_PORT__: '8787'
    })

    expect(getServerBaseUrl()).toBe('https://standalone.example.com')
    expect(createServerUrl('/api/auth/status')).toBe('https://standalone.example.com/api/auth/status')
  })

  it('persists normalized standalone server addresses', () => {
    expect(setStoredServerBaseUrl('http://localhost:8787/')).toBe('http://localhost:8787')
    expect(localStorage.getItem(SERVER_BASE_URL_STORAGE_KEY)).toBe('http://localhost:8787')
  })

  it('uses the configured desktop runtime host and port as the default backend', () => {
    setRuntimeEnv({
      __VF_PROJECT_AI_CLIENT_MODE__: 'desktop',
      __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
      __VF_PROJECT_AI_SERVER_PORT__: '43123'
    })

    expect(isDesktopClientMode()).toBe(true)
    expect(isServerConnectionManagedClientMode()).toBe(true)
    expect(getConfiguredServerBaseUrl()).toBe('http://127.0.0.1:43123')
    expect(getServerBaseUrl()).toBe('http://127.0.0.1:43123')
  })

  it('stores and clears the forced server picker flag', () => {
    setStoredServerBaseUrl('https://remote.example.com')

    requestServerConnectionPicker({ clearCurrentServer: true })

    expect(localStorage.getItem(SERVER_BASE_URL_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(SERVER_CONNECTION_PICKER_STORAGE_KEY)).toBe('true')
    expect(isServerConnectionPickerRequested()).toBe(true)

    clearServerConnectionPickerRequest()
    expect(localStorage.getItem(SERVER_CONNECTION_PICKER_STORAGE_KEY)).toBeNull()
  })
})
