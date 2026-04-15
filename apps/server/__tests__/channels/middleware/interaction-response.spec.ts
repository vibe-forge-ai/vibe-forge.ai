import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { interactionResponseMiddleware } from '#~/channels/middleware/interaction-response.js'
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

const invalidSingleReply =
  '未识别你的回复，请回复以下任一选项的文本或序号：\n1. 继续并切换到 dontAsk\n2. 继续并切换到 bypassPermissions\n3. 取消'
const invalidMultiReply =
  '未识别这些选项：好的。\n请回复以下选项的文本或序号，多个选项可用逗号、顿号或换行分隔：\n1. 米饭\n2. 面条\n3. 还没吃'

const makeInteraction = (payload: Record<string, unknown>) => ({
  id: 'interaction-1',
  payload: {
    sessionId: 'sess-1',
    ...payload
  }
} as any)

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

describe('interactionResponseMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defineMessages('zh', {
      'interaction.response.empty': '当前问题只接受文本回复，请直接回复文字。',
      'interaction.response.invalidSingle': ({ choices }) =>
        `未识别你的回复，请回复以下任一选项的文本或序号：\n${choices}`,
      'interaction.response.invalidMulti': ({ invalid, choices }) =>
        `未识别这些选项：${invalid}。\n请回复以下选项的文本或序号，多个选项可用逗号、顿号或换行分隔：\n${choices}`
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
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '晚上吃了什么？'
    }))
    const ctx = makeCtx({
      commandText: '   ',
      reply: vi.fn().mockResolvedValue(undefined)
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith('当前问题只接受文本回复，请直接回复文字。')
    expect(vi.mocked(handleInteractionResponse)).not.toHaveBeenCalled()
  })

  it('resolves single-select replies by option number', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '继续吗？',
      options: [
        { label: '继续并切换到 dontAsk', value: 'dontAsk' },
        { label: '取消', value: 'cancel' }
      ],
      kind: 'permission'
    }))
    const ctx = makeCtx({
      commandText: '1'
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(vi.mocked(handleInteractionResponse)).toHaveBeenCalledWith('sess-1', 'interaction-1', 'dontAsk')
  })

  it('replies with a retry hint when single-select text does not match any option', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '继续吗？',
      options: [
        { label: '继续并切换到 dontAsk', value: 'dontAsk' },
        { label: '继续并切换到 bypassPermissions', value: 'bypassPermissions' },
        { label: '取消', value: 'cancel' }
      ],
      kind: 'permission'
    }))
    const ctx = makeCtx({
      commandText: '好的'
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith(invalidSingleReply)
    expect(vi.mocked(handleInteractionResponse)).not.toHaveBeenCalled()
    expect(ctx.inbound.ack).not.toHaveBeenCalled()
  })

  it('rejects multi-select replies that contain invalid selections', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '晚上吃了什么？',
      multiselect: true,
      options: [
        { label: '米饭' },
        { label: '面条' },
        { label: '还没吃' }
      ],
      kind: 'permission'
    }))
    const ctx = makeCtx({
      commandText: '米饭，好的'
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith(invalidMultiReply)
    expect(vi.mocked(handleInteractionResponse)).not.toHaveBeenCalled()
  })

  it('accepts free-text answers for question interactions even when options exist', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '今晚吃了什么？',
      options: [
        { label: '米饭' },
        { label: '面条' },
        { label: '还没吃' }
      ]
    }))
    const ctx = makeCtx({
      commandText: '刚吃了烧烤'
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(vi.mocked(handleInteractionResponse)).toHaveBeenCalledWith('sess-1', 'interaction-1', '刚吃了烧烤')
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('preserves detailed free-text answers instead of collapsing them into fuzzy option matches', async () => {
    vi.mocked(getSessionInteraction).mockReturnValue(makeInteraction({
      question: '今晚吃了什么？',
      options: [
        { label: '米饭' },
        { label: '面条' },
        { label: '还没吃' }
      ]
    }))
    const ctx = makeCtx({
      commandText: '刚吃了面条和烧烤'
    })

    await interactionResponseMiddleware(ctx, vi.fn())

    expect(vi.mocked(handleInteractionResponse)).toHaveBeenCalledWith('sess-1', 'interaction-1', '刚吃了面条和烧烤')
    expect(ctx.reply).not.toHaveBeenCalled()
  })
})
