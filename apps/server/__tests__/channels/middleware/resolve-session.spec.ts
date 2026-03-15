import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { resolveSessionMiddleware } from '#~/channels/middleware/resolve-session.js'
import { getDb } from '#~/db/index.js'

const makeCtx = (): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1' } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  contentItems: undefined,
  commandText: '',
  reply: vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => vi.clearAllMocks())

describe('resolveSessionMiddleware', () => {
  it('sets ctx.sessionId when the DB finds a matching session', async () => {
    vi.mocked(getDb).mockReturnValue({ getChannelSession: vi.fn().mockReturnValue({ sessionId: 'sess-abc' }) } as any)
    const ctx = makeCtx()
    const next = vi.fn().mockResolvedValue(undefined)

    await resolveSessionMiddleware(ctx, next)

    expect(ctx.sessionId).toBe('sess-abc')
    expect(next).toHaveBeenCalledOnce()
  })

  it('leaves ctx.sessionId undefined when no session is found', async () => {
    vi.mocked(getDb).mockReturnValue({ getChannelSession: vi.fn().mockReturnValue(undefined) } as any)
    const ctx = makeCtx()
    const next = vi.fn().mockResolvedValue(undefined)

    await resolveSessionMiddleware(ctx, next)

    expect(ctx.sessionId).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it('queries using channelType, sessionType, and channelId', async () => {
    const getChannelSession = vi.fn().mockReturnValue(null)
    vi.mocked(getDb).mockReturnValue({ getChannelSession } as any)
    const ctx = makeCtx()

    await resolveSessionMiddleware(ctx, vi.fn())

    expect(getChannelSession).toHaveBeenCalledWith('lark', 'direct', 'ch1')
  })
})
