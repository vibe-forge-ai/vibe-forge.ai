import { describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { accessControlMiddleware, checkChannelAccess } from '#~/channels/middleware/access-control.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'

const makeInbound = (overrides: Record<string, unknown> = {}) => ({
  channelType: 'lark',
  channelId: 'ch1',
  sessionType: 'direct' as const,
  messageId: 'm1',
  senderId: 'user1',
  ...overrides
})

// ── checkChannelAccess ──────────────────────────────────────────────────────

describe('checkChannelAccess', () => {
  it('returns true when config is undefined', () => {
    expect(checkChannelAccess(makeInbound() as any, undefined)).toBe(true)
  })

  it('returns true when access config is absent', () => {
    expect(checkChannelAccess(makeInbound() as any, {} as any)).toBe(true)
  })

  it('admits an admin regardless of other restrictions', () => {
    const config: any = {
      access: {
        admins: ['admin1'],
        allowPrivateChat: false,
        blockedSenders: ['admin1']
      }
    }
    expect(checkChannelAccess(makeInbound({ senderId: 'admin1' }) as any, config)).toBe(true)
  })

  it('blocks private chat when allowPrivateChat is false', () => {
    const config: any = { access: { allowPrivateChat: false } }
    expect(checkChannelAccess(makeInbound({ sessionType: 'direct' }) as any, config)).toBe(false)
  })

  it('allows private chat when allowPrivateChat is not set', () => {
    const config: any = { access: {} }
    expect(checkChannelAccess(makeInbound({ sessionType: 'direct' }) as any, config)).toBe(true)
  })

  it('blocks group chat when allowGroupChat is false', () => {
    const config: any = { access: { allowGroupChat: false } }
    expect(checkChannelAccess(makeInbound({ sessionType: 'group' }) as any, config)).toBe(false)
  })

  it('blocks a group in blockedGroups', () => {
    const config: any = { access: { blockedGroups: ['grp1'] } }
    expect(checkChannelAccess(makeInbound({ sessionType: 'group', channelId: 'grp1' }) as any, config)).toBe(false)
  })

  it('blocks a group not in allowedGroups whitelist', () => {
    const config: any = { access: { allowedGroups: ['grp-ok'] } }
    expect(checkChannelAccess(makeInbound({ sessionType: 'group', channelId: 'grp-other' }) as any, config)).toBe(false)
  })

  it('allows a group that is in allowedGroups', () => {
    const config: any = { access: { allowedGroups: ['grp-ok'] } }
    expect(checkChannelAccess(makeInbound({ sessionType: 'group', channelId: 'grp-ok' }) as any, config)).toBe(true)
  })

  it('blocks a sender in blockedSenders', () => {
    const config: any = { access: { blockedSenders: ['bad-user'] } }
    expect(checkChannelAccess(makeInbound({ senderId: 'bad-user' }) as any, config)).toBe(false)
  })

  it('blocks a sender not in allowedSenders whitelist', () => {
    const config: any = { access: { allowedSenders: ['ok-user'] } }
    expect(checkChannelAccess(makeInbound({ senderId: 'other' }) as any, config)).toBe(false)
  })

  it('allows a sender in allowedSenders', () => {
    const config: any = { access: { allowedSenders: ['ok-user'] } }
    expect(checkChannelAccess(makeInbound({ senderId: 'ok-user' }) as any, config)).toBe(true)
  })

  it('blockedSenders takes priority over allowedSenders', () => {
    const config: any = { access: { allowedSenders: ['user1'], blockedSenders: ['user1'] } }
    expect(checkChannelAccess(makeInbound({ senderId: 'user1' }) as any, config)).toBe(false)
  })
})

// ── accessControlMiddleware ─────────────────────────────────────────────────

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: makeInbound() as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  channelAdapter: undefined,
  channelPermissionMode: undefined,
  contentItems: undefined,
  commandText: '',
  defineMessages,
  t: createT(undefined),
  reply: vi.fn().mockResolvedValue(undefined),
  pushFollowUps: vi.fn().mockResolvedValue(undefined),
  getBoundSession: vi.fn(),
  resetSession: vi.fn(),
  stopSession: vi.fn(),
  restartSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  getChannelAdapterPreference: vi.fn(),
  setChannelAdapterPreference: vi.fn(),
  getChannelPermissionModePreference: vi.fn(),
  setChannelPermissionModePreference: vi.fn(),
  ...overrides
})

describe('accessControlMiddleware', () => {
  it('calls next when access is granted', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await accessControlMiddleware(makeCtx(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('stops the chain when access is denied', async () => {
    const next = vi.fn()
    const ctx = makeCtx({ config: { access: { allowPrivateChat: false } } as any })
    await accessControlMiddleware(ctx, next)
    expect(next).not.toHaveBeenCalled()
  })
})
