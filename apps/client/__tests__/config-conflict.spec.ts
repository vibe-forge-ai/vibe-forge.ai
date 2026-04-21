import { describe, expect, it } from 'vitest'

import {
  getConfigDraftKey,
  resolveRemoteConfigChangeAction,
  serializeComparableConfigValue
} from '#~/components/config/configConflict'

describe('config conflict helpers', () => {
  it('builds stable draft keys for section sources', () => {
    expect(getConfigDraftKey('general', 'project')).toBe('project:general')
    expect(getConfigDraftKey('models', 'user')).toBe('user:models')
  })

  it('normalizes object keys before comparing values', () => {
    const first = serializeComparableConfigValue({
      general: {
        env: {
          API_KEY: 'demo',
          REGION: 'cn'
        }
      }
    })
    const second = serializeComparableConfigValue({
      general: {
        env: {
          REGION: 'cn',
          API_KEY: 'demo'
        }
      }
    })

    expect(first).toBe(second)
  })

  it('syncs the draft when only the remote copy changed', () => {
    expect(resolveRemoteConfigChangeAction({
      baseSerialized: serializeComparableConfigValue({ retries: 1 }),
      draftSerialized: serializeComparableConfigValue({ retries: 1 }),
      serverSerialized: serializeComparableConfigValue({ retries: 2 })
    })).toBe('sync-remote')
  })

  it('reports a conflict when both local and remote copies changed', () => {
    expect(resolveRemoteConfigChangeAction({
      baseSerialized: serializeComparableConfigValue({ retries: 1 }),
      draftSerialized: serializeComparableConfigValue({ retries: 3 }),
      serverSerialized: serializeComparableConfigValue({ retries: 2 })
    })).toBe('conflict')
  })

  it('does not flag a conflict once the local draft already matches the server', () => {
    expect(resolveRemoteConfigChangeAction({
      baseSerialized: serializeComparableConfigValue({ retries: 1 }),
      draftSerialized: serializeComparableConfigValue({ retries: 2 }),
      serverSerialized: serializeComparableConfigValue({ retries: 2 })
    })).toBe('none')
  })
})
