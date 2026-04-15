import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { adminGateMiddleware } from '#~/channels/middleware/admin-gate.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1', senderId: 'user1' } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  channelAdapter: undefined,
  channelPermissionMode: undefined,
  channelEffort: undefined,
  contentItems: undefined,
  commandText: '',
  defineMessages,
  t: createT(undefined),
  reply: vi.fn().mockResolvedValue(undefined),
  pushFollowUps: vi.fn().mockResolvedValue(undefined),
  getBoundSession: vi.fn(),
  searchSessions: vi.fn(() => []),
  bindSession: vi.fn(() => ({ alreadyBound: false })),
  unbindSession: vi.fn(() => ({})),
  resetSession: vi.fn(),
  stopSession: vi.fn(),
  restartSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  getChannelAdapterPreference: vi.fn(),
  setChannelAdapterPreference: vi.fn(),
  getChannelPermissionModePreference: vi.fn(),
  setChannelPermissionModePreference: vi.fn(),
  getChannelEffortPreference: vi.fn(),
  setChannelEffortPreference: vi.fn(),
  ...overrides,
  resolveSessionWorkspace: overrides.resolveSessionWorkspace ?? vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => vi.clearAllMocks())

describe('adminGateMiddleware', () => {
  it('passes through when sessionId already exists', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ sessionId: 'sess-1' })
    await adminGateMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('passes through when no admins are configured', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await adminGateMiddleware(makeCtx({ config: { access: {} } as any }), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('passes through when admins list is empty', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await adminGateMiddleware(makeCtx({ config: { access: { admins: [] } } as any }), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('passes through when the sender is an admin', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({
      config: { access: { admins: ['admin1'] } } as any,
      inbound: {
        channelType: 'lark',
        channelId: 'ch1',
        sessionType: 'direct',
        messageId: 'm1',
        senderId: 'admin1'
      } as any
    })
    await adminGateMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('blocks and replies when sender is not an admin and no session exists', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      config: { access: { admins: ['admin1'] } } as any,
      inbound: {
        channelType: 'lark',
        channelId: 'ch1',
        sessionType: 'direct',
        messageId: 'm1',
        senderId: 'user99'
      } as any
    })

    await adminGateMiddleware(ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
  })

  it('blocks when senderId is absent and admins are configured', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      config: { access: { admins: ['admin1'] } } as any,
      inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1' } as any
    })

    await adminGateMiddleware(ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
  })
})
