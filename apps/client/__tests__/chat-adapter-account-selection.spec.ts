import { describe, expect, it } from 'vitest'

import { resolveChatAdapterAccountKey } from '#~/hooks/chat/account-selection'

describe('resolveChatAdapterAccountKey', () => {
  const accountOptions = [
    {
      value: 'work',
      label: 'yijie4188@outlook.com · Personal'
    },
    {
      value: 'backup',
      label: 'Backup'
    }
  ]

  it('keeps explicit account keys', () => {
    expect(resolveChatAdapterAccountKey({
      value: 'work',
      accountOptions,
      defaultAccount: 'backup'
    })).toBe('work')
  })

  it('maps legacy display titles back to account keys', () => {
    expect(resolveChatAdapterAccountKey({
      value: 'yijie4188@outlook.com · Personal',
      accountOptions,
      defaultAccount: 'backup'
    })).toBe('work')
  })

  it('falls back to the default account when the stored value is invalid', () => {
    expect(resolveChatAdapterAccountKey({
      value: 'unknown account',
      accountOptions,
      defaultAccount: 'backup'
    })).toBe('backup')
  })

  it('returns undefined when no catalog is available yet', () => {
    expect(resolveChatAdapterAccountKey({
      value: 'yijie4188@outlook.com · Personal',
      accountOptions: []
    })).toBeUndefined()
  })
})
