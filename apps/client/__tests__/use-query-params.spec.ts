import { describe, expect, it } from 'vitest'

import { buildQueryParamNavigationTarget, resolveQueryParamPathname } from '#~/hooks/useQueryParams'

describe('useQueryParams helpers', () => {
  it('keeps the active session pathname when updating query params after navigation', () => {
    expect(buildQueryParamNavigationTarget<{ senderHeader: string }>({
      clientBase: '/ui',
      currentHash: '',
      currentPathname: '/ui/session/session-123',
      currentSearch: '',
      defaults: {
        senderHeader: ''
      },
      keySet: new Set(['senderHeader']),
      keys: ['senderHeader'],
      omit: {
        senderHeader: value => value === ''
      },
      patch: {
        senderHeader: 'collapsed'
      }
    })).toEqual({
      pathname: '/session/session-123',
      search: '?senderHeader=collapsed',
      hash: ''
    })
  })

  it('preserves unrelated query params and hash fragments', () => {
    expect(buildQueryParamNavigationTarget<{ senderHeader: string }>({
      clientBase: '/ui',
      currentHash: '#message-1',
      currentPathname: '/ui/session/session-123',
      currentSearch: '?layout=workspace',
      defaults: {
        senderHeader: ''
      },
      keySet: new Set(['senderHeader']),
      keys: ['senderHeader'],
      omit: {
        senderHeader: value => value === ''
      },
      patch: {
        senderHeader: 'collapsed'
      }
    })).toEqual({
      pathname: '/session/session-123',
      search: '?senderHeader=collapsed&layout=workspace',
      hash: '#message-1'
    })
  })

  it('returns null when the query payload does not change', () => {
    expect(buildQueryParamNavigationTarget<{ senderHeader: string }>({
      clientBase: '/ui',
      currentHash: '',
      currentPathname: '/ui/session/session-123',
      currentSearch: '?senderHeader=collapsed',
      defaults: {
        senderHeader: ''
      },
      keySet: new Set(['senderHeader']),
      keys: ['senderHeader'],
      omit: {
        senderHeader: value => value === ''
      },
      patch: {
        senderHeader: 'collapsed'
      }
    })).toBeNull()
  })

  it('normalizes a basename-prefixed pathname into an app-relative route', () => {
    expect(resolveQueryParamPathname('/ui/session/session-123', '/ui')).toBe('/session/session-123')
    expect(resolveQueryParamPathname('/ui', '/ui')).toBe('/')
    expect(resolveQueryParamPathname('/session/session-123', '/ui')).toBe('/session/session-123')
  })
})
