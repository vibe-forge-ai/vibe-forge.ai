import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteBinding, setBinding } from '#~/channels/state.js'
import { sendToolCallJsonFile } from '#~/channels/tool-call-file.js'
import { getDb } from '#~/db/index.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

describe('tool-call-file', () => {
  const getMessages = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    deleteBinding('sess-1')
    setBinding('sess-1', {
      channelType: 'lark',
      channelKey: 'test',
      channelId: 'chat_1',
      sessionType: 'direct',
      replyReceiveId: 'chat_1',
      replyReceiveIdType: 'chat_id'
    })
    vi.mocked(getDb).mockReturnValue({
      getMessages
    } as any)
  })

  afterEach(() => {
    deleteBinding('sess-1')
  })

  it('rebuilds the tool payload from session history and sends it as a file to the bound chat', async () => {
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'msg-tool-use',
          role: 'assistant',
          createdAt: 1,
          content: [{
            type: 'tool_use',
            id: 'tool-1',
            name: 'adapter:claude-code:mcp__channel-lark-test__GetCurrentChatMessages',
            input: {
              limit: 50
            }
          }]
        }
      },
      {
        type: 'message',
        message: {
          id: 'msg-tool-result',
          role: 'assistant',
          createdAt: 2,
          content: [{
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: {
              items: [{ id: 'm1' }, { id: 'm2' }]
            }
          }]
        }
      }
    ])
    const sendFileMessage = vi.fn().mockResolvedValue({ messageId: 'om_file' })
    const states = new Map([
      ['test', {
        key: 'test',
        type: 'lark',
        status: 'connected',
        config: {
          type: 'lark'
        },
        connection: {
          sendFileMessage
        }
      } as any]
    ])

    const result = await sendToolCallJsonFile(states, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-assistant'
    })

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusCode: 200,
      fileName: 'GetCurrentChatMessages-tool-1.json',
      detailUrl: 'http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1&messageId=msg-assistant'
    }))
    expect(sendFileMessage).toHaveBeenCalledWith(expect.objectContaining({
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      fileName: 'GetCurrentChatMessages-tool-1.json',
      content: expect.any(String)
    }))

    const payload = JSON.parse(sendFileMessage.mock.calls[0]![0].content)
    expect(payload).toMatchObject({
      sessionId: 'sess-1',
      messageId: 'msg-assistant',
      toolUseId: 'tool-1',
      name: 'adapter:claude-code:mcp__channel-lark-test__GetCurrentChatMessages',
      status: 'success',
      args: {
        limit: 50
      },
      result: {
        items: [{ id: 'm1' }, { id: 'm2' }]
      },
      detailUrl: 'http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1&messageId=msg-assistant'
    })
  })
})
