import { describe, expect, it, vi } from 'vitest'

describe('lark channel interaction tools', () => {
  it('replies to a message with a template card', async () => {
    vi.resetModules()
    const replyByCard = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_reply_card'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            replyByCard
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu'
    })

    const result = await service.replyTemplateCard({
      messageId: 'om_source',
      templateId: 'ctp_AA',
      templateVariable: {
        title: 'Thread update'
      },
      replyInThread: true
    })

    expect(replyByCard).toHaveBeenCalledWith({
      path: {
        message_id: 'om_source'
      },
      data: {
        template_id: 'ctp_AA',
        template_variable: {
          title: 'Thread update'
        },
        reply_in_thread: true,
        uuid: undefined
      }
    })
    expect(result).toEqual({
      templateId: 'ctp_AA',
      sourceMessageId: 'om_source',
      messageId: 'om_reply_card'
    })
  })

  it('lists message history in the bound chat by default', async () => {
    vi.resetModules()
    const list = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [{ message_id: 'om_1' }],
        has_more: false
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            list
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu',
      channelId: 'chat_1'
    })

    const result = await service.listMessages({
      pageSize: 20,
      sortType: 'ByCreateTimeDesc'
    })

    expect(list).toHaveBeenCalledWith({
      params: {
        container_id: 'chat_1',
        container_id_type: 'chat',
        start_time: undefined,
        end_time: undefined,
        sort_type: 'ByCreateTimeDesc',
        page_size: 20,
        page_token: undefined
      }
    })
    expect(result).toEqual({
      items: [{ message_id: 'om_1' }],
      has_more: false
    })
  })

  it('adds a reaction to a message', async () => {
    vi.resetModules()
    const createReaction = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        reaction_id: 'rct_1'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          messageReaction: {
            create: createReaction
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu'
    })

    const result = await service.addMessageReaction({
      messageId: 'om_1',
      emojiType: 'SMILE'
    })

    expect(createReaction).toHaveBeenCalledWith({
      path: {
        message_id: 'om_1'
      },
      data: {
        reaction_type: {
          emoji_type: 'SMILE'
        }
      }
    })
    expect(result).toEqual({
      reaction_id: 'rct_1'
    })
  })

  it('lists pins in the bound chat by default', async () => {
    vi.resetModules()
    const listPins = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [{ message_id: 'om_pinned' }],
        has_more: false
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          pin: {
            list: listPins
          }
        },
        contact: {}
      })),
      Domain: {
        Feishu: 'Feishu',
        Lark: 'Lark'
      }
    }))

    const { createLarkMcpService } = await import('#~/mcp/service.js')
    const service = createLarkMcpService({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu',
      channelId: 'chat_1'
    })

    const result = await service.listPins({})

    expect(listPins).toHaveBeenCalledWith({
      params: {
        chat_id: 'chat_1',
        start_time: undefined,
        end_time: undefined,
        page_size: undefined,
        page_token: undefined
      }
    })
    expect(result).toEqual({
      items: [{ message_id: 'om_pinned' }],
      has_more: false
    })
  })
})
