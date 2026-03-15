import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#~/channels/state.js', () => ({
  isDuplicateMessage: vi.fn()
}))

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { deduplicateMiddleware } from '#~/channels/middleware/deduplicate.js'
import { isDuplicateMessage } from '#~/channels/state.js'

const makeCtx = (messageId = 'msg1'): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  contentItems: undefined,
  commandText: '',
  reply: vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => vi.clearAllMocks())

describe('deduplicateMiddleware', () => {
  it('calls next when message is not a duplicate', async () => {
    vi.mocked(isDuplicateMessage).mockReturnValue(false)
    const next = vi.fn().mockResolvedValue(undefined)

    await deduplicateMiddleware(makeCtx(), next)

    expect(isDuplicateMessage).toHaveBeenCalledWith('lark:direct:ch1:msg1')
    expect(next).toHaveBeenCalledOnce()
  })

  it('stops the chain for a duplicate message', async () => {
    vi.mocked(isDuplicateMessage).mockReturnValue(true)
    const next = vi.fn()

    await deduplicateMiddleware(makeCtx(), next)

    expect(next).not.toHaveBeenCalled()
  })

  it('builds the dedup key from channelType, sessionType, channelId, messageId', async () => {
    vi.mocked(isDuplicateMessage).mockReturnValue(false)
    const ctx = makeCtx()
    ctx.inbound = { channelType: 'wecom', channelId: 'grp99', sessionType: 'group', messageId: 'xyz' } as any

    await deduplicateMiddleware(ctx, vi.fn())

    expect(isDuplicateMessage).toHaveBeenCalledWith('wecom:group:grp99:xyz')
  })
})
