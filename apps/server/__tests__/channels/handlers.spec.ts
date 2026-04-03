import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { handleSessionEvent } from '#~/channels/handlers.js'
import { consumePendingUnack, deleteBinding, setBinding, setPendingUnack } from '#~/channels/state.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn(() => ({
    getSession: vi.fn(),
    updateSessionArchivedWithChildren: vi.fn(() => []),
    deleteChannelSessionBySessionId: vi.fn(),
    upsertChannelPreference: vi.fn(),
    updateSession: vi.fn()
  }))
}))

vi.mock('#~/services/session/index.js', () => ({
  killSession: vi.fn(),
  startAdapterSession: vi.fn()
}))

vi.mock('#~/services/session/runtime.js', async () => {
  const actual = await vi.importActual<typeof import('#~/services/session/runtime.js')>(
    '#~/services/session/runtime.js'
  )
  return {
    ...actual,
    notifySessionUpdated: vi.fn()
  }
})

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn()
  }))
}))

const bindTestSession = () => {
  setBinding('sess-1', {
    channelType: 'lark',
    channelKey: 'test',
    channelId: 'chat_1',
    sessionType: 'direct',
    replyReceiveId: 'chat_1',
    replyReceiveIdType: 'chat_id'
  })
}

const makeRuntimeState = (
  input: {
    sendMessage?: ReturnType<typeof vi.fn>
    pushFollowUps?: ReturnType<typeof vi.fn>
    language?: 'zh' | 'en'
  } = {}
) => new Map([
  ['test', {
    key: 'test',
    type: 'lark',
    status: 'connected',
    config: {
      type: 'lark',
      language: input.language ?? 'zh'
    },
    connection: {
      sendMessage: input.sendMessage ?? vi.fn().mockResolvedValue({ messageId: 'om_default' }),
      pushFollowUps: input.pushFollowUps ?? vi.fn().mockResolvedValue(undefined)
    }
  } as any]
])

const makeInteractionRequestEvent = (
  payload: Record<string, unknown>,
  id = 'interaction-1'
) => ({
  type: 'interaction_request',
  id,
  payload: {
    sessionId: 'sess-1',
    ...payload
  }
}) as any

describe('channel handlers', () => {
  beforeEach(() => {
    deleteBinding('sess-1')
    consumePendingUnack('sess-1')
  })

  afterEach(() => {
    deleteBinding('sess-1')
    consumePendingUnack('sess-1')
  })

  it('delivers interaction requests to the bound channel and attaches quick actions', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: 'om_question' })
    const pushFollowUps = vi.fn().mockResolvedValue(undefined)
    const unack = vi.fn().mockResolvedValue(undefined)
    bindTestSession()
    setPendingUnack('sess-1', unack)

    const delivered = await handleSessionEvent(
      makeRuntimeState({ sendMessage, pushFollowUps }),
      'sess-1',
      makeInteractionRequestEvent({
        question: '晚上吃了什么？',
        options: [
          { label: '米饭', description: '主食' },
          { label: '面条' }
        ]
      })
    )

    expect(delivered).toBe(true)
    expect(unack).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      text: expect.stringContaining('晚上吃了什么？')
    }))
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('米饭: 主食')
    expect(pushFollowUps).toHaveBeenCalledWith({
      messageId: 'om_question',
      followUps: [
        { content: '米饭' },
        { content: '面条' }
      ]
    })
  })

  it('formats permission interactions with context and quick actions', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: 'om_permission' })
    const pushFollowUps = vi.fn().mockResolvedValue(undefined)
    bindTestSession()

    const delivered = await handleSessionEvent(
      makeRuntimeState({ sendMessage, pushFollowUps }),
      'sess-1',
      makeInteractionRequestEvent({
        kind: 'permission',
        question: '当前任务需要额外权限才能继续。是否授权后继续？',
        options: [
          { label: '继续并切换到 dontAsk', value: 'dontAsk', description: '尽量直接执行，不再额外询问。' },
          { label: '取消', value: 'cancel', description: '保持当前权限模式。' }
        ],
        permissionContext: {
          currentMode: 'default',
          suggestedMode: 'dontAsk',
          reasons: ['Write requires approval']
        }
      }, 'interaction-permission')
    )

    expect(delivered).toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      text: expect.stringContaining('[权限请求]')
    }))
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('当前模式：default')
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('建议模式：dontAsk')
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('Write requires approval')
    expect(pushFollowUps).toHaveBeenCalledWith({
      messageId: 'om_permission',
      followUps: [
        { content: '继续并切换到 dontAsk' },
        { content: '取消' }
      ]
    })
  })

  it('keeps interaction delivery successful when follow-up actions fail after the message is sent', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: 'om_question' })
    const pushFollowUps = vi.fn().mockRejectedValue(new Error('Lark push follow up failed: HTTP 400'))
    bindTestSession()

    const delivered = await handleSessionEvent(
      makeRuntimeState({ sendMessage, pushFollowUps }),
      'sess-1',
      makeInteractionRequestEvent({
        question: '晚上吃了什么？',
        options: [
          { label: '米饭', description: '主食' },
          { label: '面条' }
        ]
      })
    )

    expect(delivered).toBe(true)
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(pushFollowUps).toHaveBeenCalledOnce()
  })
})
