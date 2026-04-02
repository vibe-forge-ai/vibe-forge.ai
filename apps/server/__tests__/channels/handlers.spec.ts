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
    info: vi.fn()
  }))
}))

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
    setBinding('sess-1', {
      channelType: 'lark',
      channelKey: 'test',
      channelId: 'chat_1',
      sessionType: 'direct',
      replyReceiveId: 'chat_1',
      replyReceiveIdType: 'chat_id'
    })
    setPendingUnack('sess-1', unack)

    const delivered = await handleSessionEvent(new Map([
      ['test', {
        key: 'test',
        type: 'lark',
        status: 'connected',
        config: {
          type: 'lark',
          language: 'zh'
        },
        connection: {
          sendMessage,
          pushFollowUps
        }
      } as any]
    ]), 'sess-1', {
      type: 'interaction_request',
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '晚上吃了什么？',
        options: [
          { label: '米饭', description: '主食' },
          { label: '面条' }
        ]
      }
    } as any)

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
})
