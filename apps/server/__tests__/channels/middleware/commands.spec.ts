import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/channels/state.js', () => ({
  deleteBinding: vi.fn()
}))

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { channelCommandMiddleware } from '#~/channels/middleware/commands.js'
import { deleteBinding } from '#~/channels/state.js'
import { getDb } from '#~/db/index.js'

const deleteChannelSessionBySessionId = vi.fn()

const makeInbound = (overrides: Record<string, unknown> = {}) => ({
  channelType: 'lark',
  channelId: 'ch1',
  sessionType: 'direct' as const,
  messageId: 'm1',
  senderId: 'user1',
  ack: vi.fn().mockResolvedValue(undefined),
  unack: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: makeInbound() as any,
  connection: undefined,
  config: undefined,
  sessionId: 'sess-abc',
  contentItems: undefined,
  commandText: '',
  reply: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDb).mockReturnValue({ deleteChannelSessionBySessionId } as any)
})

// ── non-command ────────────────────────────────────────────────────────────

describe('non-command input', () => {
  it('calls next for regular text', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: 'hello world' })
    await channelCommandMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('calls next when commandText is empty', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await channelCommandMiddleware(makeCtx({ commandText: '' }), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('calls next for unknown commands', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await channelCommandMiddleware(makeCtx({ commandText: '/unknown' }), next)
    expect(next).toHaveBeenCalledOnce()
  })
})

// ── /help ──────────────────────────────────────────────────────────────────

describe('/help command', () => {
  it('sends the help message and does not call next', async () => {
    const next = vi.fn()
    const ctx = makeCtx({ commandText: '/help' })
    await channelCommandMiddleware(ctx, next)

    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()
  })

  it('calls ack before replying and unack after', async () => {
    const ack = vi.fn().mockResolvedValue(undefined)
    const unack = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: '/help', inbound: makeInbound({ ack, unack }) as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ack).toHaveBeenCalledOnce()
    expect(unack).toHaveBeenCalledOnce()
  })

  it('swallows ack errors', async () => {
    const ack = vi.fn().mockRejectedValue(new Error('ack failed'))
    const ctx = makeCtx({ commandText: '/help', inbound: makeInbound({ ack }) as any })
    await expect(channelCommandMiddleware(ctx, vi.fn())).resolves.toBeUndefined()
  })
})

// ── /reset ─────────────────────────────────────────────────────────────────

describe('/reset command — no admins configured', () => {
  it('deletes the session and sends success message', async () => {
    const next = vi.fn()
    const ctx = makeCtx({ commandText: '/reset' })
    await channelCommandMiddleware(ctx, next)

    expect(deleteChannelSessionBySessionId).toHaveBeenCalledWith('sess-abc')
    expect(deleteBinding).toHaveBeenCalledWith('sess-abc')
    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()
  })

  it('clears ctx.sessionId after reset', async () => {
    const ctx = makeCtx({ commandText: '/reset' })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.sessionId).toBeUndefined()
  })

  it('still sends success when sessionId is undefined (no active session)', async () => {
    const ctx = makeCtx({ commandText: '/reset', sessionId: undefined })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
    expect(deleteBinding).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
  })

  it('calls ack and unack', async () => {
    const ack = vi.fn().mockResolvedValue(undefined)
    const unack = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: '/reset', inbound: makeInbound({ ack, unack }) as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ack).toHaveBeenCalledOnce()
    expect(unack).toHaveBeenCalledOnce()
  })
})

describe('/reset command — admins configured', () => {
  const configWithAdmins: any = { access: { admins: ['admin1'] } }

  it('allows an admin to reset', async () => {
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: 'admin1' }) as any
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(deleteChannelSessionBySessionId).toHaveBeenCalledWith('sess-abc')
    expect(ctx.reply).toHaveBeenCalledOnce()
  })

  it('blocks a non-admin sender and sends permission error', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: 'user99' }) as any
    })
    await channelCommandMiddleware(ctx, next)

    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
    const msg = vi.mocked(ctx.reply).mock.calls[0][0]
    expect(msg).toContain('没有权限')
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks when senderId is absent', async () => {
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: undefined }) as any
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
  })
})
