import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { interactionResponseMiddleware } from '#~/channels/middleware/interaction-response.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { getSessionInteraction, handleInteractionResponse } from '#~/services/session/interaction.js'

import { syncChannelSessionBinding } from '#~/channels/middleware/bind-session.js'

vi.mock('#~/services/session/interaction.js', () => ({
  getSessionInteraction: vi.fn(),
  handleInteractionResponse: vi.fn()
}))

vi.mock('#~/channels/middleware/bind-session.js', () => ({
  syncChannelSessionBinding: vi.fn()
}))

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn()
  }))
}))

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:test',
  inbound: {
    channelType: 'lark',
    channelId: 'chat_1',
    sessionType: 'direct',
    messageId: 'm1',
    senderId: 'user_1',
    text: '米饭，面条',
    ack: vi.fn().mockResolvedValue(undefined)
  } as any,
  connection: undefined,
  config: undefined,
  sessionId: 'sess-1',
  channelAdapter: undefined,
  channelPermissionMode: undefined,
  channelEffort: undefined,
  contentItems: undefined,
  commandText: '米饭，面条',
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
  setChannelEffortPreference: vi.fn(),
  ...overrides
})

describe('interactionResponseMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defineMessages('zh', {
      'interaction.response.empty': '当前问题只接受文本回复，请直接回复文字。'
    })
  })

  it('consumes channel replies for pending multi-select interactions', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '晚上吃了什么？',
        multiselect: true
      }
    } as any)
    const ctx = makeCtx()
    const next = vi.fn()

    await interactionResponseMiddleware(ctx, next)

    expect(ctx.inbound.ack).toHaveBeenCalledOnce()
    expect(vi.mocked(syncChannelSessionBinding)).toHaveBeenCalledWith({
      channelKey: 'lark:test',
      inbound: ctx.inbound,
      sessionId: 'sess-1'
    })
    expect(vi.mocked(handleInteractionResponse)).toHaveBeenCalledWith('sess-1', 'interaction-1', ['米饭', '面条'])
    expect(next).not.toHaveBeenCalled()
  })

  it('replies when the pending interaction response is empty', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '晚上吃了什么？'
      }
    } as any)
    const ctx = makeCtx({
      commandText: '   ',
      reply: vi.fn().mockResolvedValue(undefined)
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith('当前问题只接受文本回复，请直接回复文字。')
    expect(vi.mocked(handleInteractionResponse)).not.toHaveBeenCalled()
  })
})
