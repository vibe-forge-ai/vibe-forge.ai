import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { ackMiddleware } from '#~/channels/middleware/ack.js'

const makeCtx = (ack?: () => Promise<void>): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1', ack } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  contentItems: undefined,
  commandText: '',
  reply: vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => vi.clearAllMocks())

describe('ackMiddleware', () => {
  it('calls ack and then next', async () => {
    const ack = vi.fn().mockResolvedValue(undefined)
    const next = vi.fn().mockResolvedValue(undefined)

    await ackMiddleware(makeCtx(ack), next)

    expect(ack).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
  })

  it('calls next even when ack is undefined', async () => {
    const next = vi.fn().mockResolvedValue(undefined)

    await ackMiddleware(makeCtx(undefined), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('swallows errors from ack and still calls next', async () => {
    const ack = vi.fn().mockRejectedValue(new Error('ack failed'))
    const next = vi.fn().mockResolvedValue(undefined)

    await ackMiddleware(makeCtx(ack), next)

    expect(next).toHaveBeenCalledOnce()
  })
})
