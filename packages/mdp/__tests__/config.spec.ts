import { describe, expect, it } from 'vitest'

import { parseSyntheticClientId, toSyntheticClientId } from '#~/client-id.js'
import { resolveMdpConfig } from '#~/config.js'
import { isVisibleMdpClient, isVisibleMdpPath } from '#~/filter.js'

describe('mdp config', () => {
  it('provides a default connection when config is absent', () => {
    const resolved = resolveMdpConfig(undefined)

    expect(resolved.enabled).toBe(true)
    expect(resolved.connections).toEqual([
      {
        key: 'default',
        hosts: ['ws://127.0.0.1:47372']
      }
    ])
  })

  it('keeps enabled configured connections and normalizes filters', () => {
    const resolved = resolveMdpConfig({
      mdp: {
        connections: {
          default: {
            hosts: ['ws://127.0.0.1:47372', 'ws://127.0.0.1:57372']
          },
          hidden: {
            enabled: false,
            hosts: ['ws://127.0.0.1:67372']
          }
        },
        filters: {
          excludeClientIds: ['cli-*'],
          excludeNames: ['internal*'],
          excludePaths: ['/private/*']
        }
      }
    })

    expect(resolved.connections).toHaveLength(1)
    expect(resolved.connections[0]?.hosts).toEqual([
      'ws://127.0.0.1:47372',
      'ws://127.0.0.1:57372'
    ])
    expect(resolved.filters.excludeClientIds).toEqual(['cli-*'])
    expect(resolved.filters.excludeNames).toEqual(['internal*'])
    expect(resolved.filters.excludePaths).toEqual(['/private/*'])
  })
})

describe('synthetic client ids', () => {
  it('round-trips the connection key and raw client id', () => {
    const encoded = toSyntheticClientId('primary', 'client/01')

    expect(encoded).toBe('primary::client%2F01')
    expect(parseSyntheticClientId(encoded)).toEqual({
      connectionKey: 'primary',
      rawClientId: 'client/01'
    })
  })
})

describe('mdp filters', () => {
  it('filters clients by id and name', () => {
    expect(isVisibleMdpClient({
      clientId: 'primary::cli-runner',
      rawClientId: 'cli-runner',
      name: 'CLI Runner'
    }, {
      excludeClientIds: ['cli-*'],
      excludeNames: [],
      excludePaths: []
    })).toBe(false)

    expect(isVisibleMdpClient({
      clientId: 'primary::ui',
      rawClientId: 'ui',
      name: 'internal-browser'
    }, {
      excludeClientIds: [],
      excludeNames: ['internal*'],
      excludePaths: []
    })).toBe(false)
  })

  it('filters paths after client visibility checks', () => {
    expect(isVisibleMdpPath({
      path: '/private/skill.md'
    }, {
      clientId: 'primary::workspace',
      rawClientId: 'workspace',
      name: 'Workspace'
    }, {
      excludeClientIds: [],
      excludeNames: [],
      excludePaths: ['/private/*']
    })).toBe(false)
  })
})
