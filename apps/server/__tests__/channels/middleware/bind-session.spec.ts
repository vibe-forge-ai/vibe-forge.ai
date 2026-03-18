import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { bindSessionMiddleware } from '#~/channels/middleware/bind-session.js'
import { setBinding, setPendingUnack } from '#~/channels/state.js'
import { getDb } from '#~/db/index.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/channels/state.js', () => ({
  setBinding: vi.fn(),
  setPendingUnack: vi.fn()
}))

const upsertChannelSession = vi.fn()

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: {
    channelType: 'lark',
    channelId: 'ch1',
    sessionType: 'direct',
    messageId: 'm1',
    unack: vi.fn(),
    replyTo: { receiveId: 'recv1', receiveIdType: 'chat_id' }
  } as any,
  connection: undefined,
  config: undefined,
  sessionId: 'sess-abc',
  contentItems: undefined,
  commandText: '',
  defineMessages: vi.fn(),
  t: ((key: string) => key) as any,
  reply: vi.fn().mockResolvedValue(undefined),
  pushFollowUps: vi.fn().mockResolvedValue(undefined),
  getBoundSession: vi.fn(),
  resetSession: vi.fn(),
  stopSession: vi.fn(),
  restartSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDb).mockReturnValue({ upsertChannelSession } as any)
})

describe('bindSessionMiddleware', () => {
  it('does nothing when sessionId is undefined', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await bindSessionMiddleware(makeCtx({ sessionId: undefined }), next)

    expect(upsertChannelSession).not.toHaveBeenCalled()
    expect(setBinding).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('persists session to DB with correct fields', async () => {
    await bindSessionMiddleware(makeCtx(), vi.fn().mockResolvedValue(undefined))

    expect(upsertChannelSession).toHaveBeenCalledWith({
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'ch1',
      channelKey: 'lark:default',
      replyReceiveId: 'recv1',
      replyReceiveIdType: 'chat_id',
      sessionId: 'sess-abc'
    })
  })

  it('sets in-memory binding', async () => {
    await bindSessionMiddleware(makeCtx(), vi.fn().mockResolvedValue(undefined))

    expect(setBinding).toHaveBeenCalledWith('sess-abc', {
      channelType: 'lark',
      channelKey: 'lark:default',
      channelId: 'ch1',
      sessionType: 'direct',
      replyReceiveId: 'recv1',
      replyReceiveIdType: 'chat_id'
    })
  })

  it('calls setPendingUnack with the inbound unack function', async () => {
    const unack = vi.fn()
    const ctx = makeCtx({ inbound: { ...makeCtx().inbound, unack } as any })
    await bindSessionMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

    expect(setPendingUnack).toHaveBeenCalledWith('sess-abc', unack)
  })

  it('calls next after binding', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await bindSessionMiddleware(makeCtx(), next)
    expect(next).toHaveBeenCalledOnce()
  })
})
