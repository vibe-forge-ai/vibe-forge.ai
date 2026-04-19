import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SERVER_BASE_URL_HISTORY_STORAGE_KEY,
  clearAuthTokenForServerUrl,
  getAuthTokenForServerUrl,
  getRecentServerBaseUrls,
  getServerConnectionProfiles,
  rememberServerBaseUrl,
  setAuthTokenForServerUrl,
  updateServerConnectionProfile
} from '#~/server-connection-history'

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

describe('server connection history', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps saved server addresses normalized, unique, and newest-first without a count limit', () => {
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => ++now)

    for (
      const value of [
        'http://one.example.com/',
        'https://two.example.com/base/',
        'https://three.example.com',
        'http://four.example.com',
        'https://five.example.com',
        'http://six.example.com',
        'https://two.example.com/base'
      ]
    ) {
      rememberServerBaseUrl(value)
    }

    expect(getRecentServerBaseUrls()).toEqual([
      'https://two.example.com/base',
      'http://six.example.com',
      'https://five.example.com',
      'http://four.example.com',
      'https://three.example.com',
      'http://one.example.com'
    ])
  })

  it('ignores invalid recent server address history', () => {
    localStorage.setItem(
      SERVER_BASE_URL_HISTORY_STORAGE_KEY,
      JSON.stringify([
        'https://api.example.com/',
        'ftp://api.example.com',
        null,
        'https://api.example.com'
      ])
    )

    expect(getRecentServerBaseUrls()).toEqual(['https://api.example.com'])
  })

  it('stores profile details and auth tokens per backend service', () => {
    rememberServerBaseUrl('https://one.example.com', { serverVersion: '1.2.3' })
    rememberServerBaseUrl('https://two.example.com')
    updateServerConnectionProfile('https://one.example.com', {
      alias: 'Home computer',
      description: 'Private tailnet'
    })
    setAuthTokenForServerUrl('https://one.example.com', 'token-one')
    setAuthTokenForServerUrl('https://two.example.com', 'token-two')

    expect(getAuthTokenForServerUrl('https://one.example.com')).toBe('token-one')
    expect(getAuthTokenForServerUrl('https://two.example.com')).toBe('token-two')
    expect(getServerConnectionProfiles().find(profile => profile.serverUrl === 'https://one.example.com'))
      .toMatchObject({
        alias: 'Home computer',
        description: 'Private tailnet',
        authToken: 'token-one',
        serverVersion: '1.2.3'
      })

    clearAuthTokenForServerUrl('https://one.example.com')
    expect(getAuthTokenForServerUrl('https://one.example.com')).toBeUndefined()
    expect(getAuthTokenForServerUrl('https://two.example.com')).toBe('token-two')
  })

  it('clears profile text fields when the user saves empty values', () => {
    rememberServerBaseUrl('https://one.example.com')
    updateServerConnectionProfile('https://one.example.com', {
      alias: 'Home computer',
      description: 'Private tailnet'
    })

    updateServerConnectionProfile('https://one.example.com', {
      alias: '',
      description: '   '
    })

    expect(getServerConnectionProfiles().find(profile => profile.serverUrl === 'https://one.example.com'))
      .toEqual({
        serverUrl: 'https://one.example.com',
        createdAt: expect.any(Number),
        lastConnectedAt: expect.any(Number)
      })
  })
})
