import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { ackMiddleware } from '#~/channels/middleware/ack.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'

const makeCtx = (ack?: () => Promise<void>): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1', ack } as any,
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
  resetSession: vi.fn(),
  stopSession: vi.fn(),
  restartSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  getChannelAdapterPreference: vi.fn(),
  setChannelAdapterPreference: vi.fn(),
  getChannelPermissionModePreference: vi.fn(),
  setChannelPermissionModePreference: vi.fn(),
  getChannelEffortPreference: vi.fn(),
  setChannelEffortPreference: vi.fn()
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
