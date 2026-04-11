/* eslint-disable max-lines */

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

  it('gets normalized current chat messages from the bound chat', async () => {
    vi.resetModules()
    const list = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [
          {
            message_id: 'om_post',
            msg_type: 'post',
            create_time: '1775578733730',
            update_time: '1775578733730',
            deleted: false,
            updated: false,
            chat_id: 'chat_1',
            sender: {
              id: 'ou_1',
              id_type: 'open_id',
              sender_type: 'user',
              tenant_key: 'tenant_1'
            },
            body: {
              content: JSON.stringify({
                title: '',
                content: [
                  [{ tag: 'text', text: '刚刚讨论了 MCP 聊天记录能力', style: [] }]
                ]
              })
            }
          },
          {
            message_id: 'om_file',
            msg_type: 'file',
            create_time: '1775578720000',
            update_time: '1775578720000',
            deleted: false,
            updated: false,
            chat_id: 'chat_1',
            sender: {
              id: 'cli_app',
              id_type: 'app_id',
              sender_type: 'app',
              tenant_key: 'tenant_1'
            },
            body: {
              content: JSON.stringify({
                file_key: 'file_1',
                file_name: 'README.md'
              })
            }
          }
        ],
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
      channelId: 'chat_1',
      sessionType: 'direct'
    })

    const result = await service.getCurrentChatMessages({
      limit: 2
    })

    expect(list).toHaveBeenCalledWith({
      params: {
        container_id: 'chat_1',
        container_id_type: 'chat',
        start_time: undefined,
        sort_type: 'ByCreateTimeDesc',
        page_size: 20,
        page_token: undefined
      }
    })
    expect(result).toMatchObject({
      chatId: 'chat_1',
      sessionType: 'direct',
      scannedCount: 2,
      matchedCount: 2,
      hasMore: false,
      appliedFilter: {
        limit: 2,
        lookbackMinutes: undefined,
        query: undefined,
        senderType: undefined,
        includeRawContent: false
      },
      messages: [
        {
          messageId: 'om_post',
          msgType: 'post',
          text: '刚刚讨论了 MCP 聊天记录能力',
          summary: '刚刚讨论了 MCP 聊天记录能力',
          sender: {
            id: 'ou_1',
            idType: 'open_id',
            senderType: 'user'
          },
          rawContent: undefined
        },
        {
          messageId: 'om_file',
          msgType: 'file',
          summary: '[file] README.md',
          sender: {
            id: 'cli_app',
            idType: 'app_id',
            senderType: 'app'
          },
          rawContent: undefined
        }
      ]
    })
  })

  it('treats an empty chatId as the bound chat fallback', async () => {
    vi.resetModules()
    const list = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [],
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
      channelId: 'chat_1',
      sessionType: 'direct'
    })

    const result = await service.getCurrentChatMessages({
      chatId: '   ',
      limit: 1
    })

    expect(list).toHaveBeenCalledWith({
      params: expect.objectContaining({
        container_id: 'chat_1',
        container_id_type: 'chat'
      })
    })
    expect(result).toMatchObject({
      chatId: 'chat_1',
      matchedCount: 0
    })
  })

  it('treats senderType unknown as no sender filter', async () => {
    vi.resetModules()
    const list = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [
          {
            message_id: 'om_1',
            msg_type: 'text',
            create_time: '1775578733730',
            update_time: '1775578733730',
            deleted: false,
            updated: false,
            chat_id: 'chat_1',
            sender: {
              id: 'ou_1',
              id_type: 'open_id',
              sender_type: 'user',
              tenant_key: 'tenant_1'
            },
            body: {
              content: JSON.stringify({
                text: '刚刚在验证聊天记录工具'
              })
            }
          }
        ],
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
      channelId: 'chat_1',
      sessionType: 'direct'
    })

    const result = await service.getCurrentChatMessages({
      limit: 1,
      senderType: 'unknown'
    })

    expect(result).toMatchObject({
      matchedCount: 1,
      appliedFilter: {
        senderType: undefined
      },
      messages: [
        {
          messageId: 'om_1',
          sender: {
            senderType: 'user'
          }
        }
      ]
    })
  })

  it('filters current chat messages by query and recent window', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T00:20:00.000Z'))

    const list = vi.fn()
      .mockResolvedValueOnce({
        code: 0,
        data: {
          items: [{
            message_id: 'om_old',
            msg_type: 'text',
            create_time: '1775578500000',
            update_time: '1775578500000',
            deleted: false,
            updated: false,
            chat_id: 'chat_1',
            sender: {
              id: 'ou_1',
              id_type: 'open_id',
              sender_type: 'user',
              tenant_key: 'tenant_1'
            },
            body: {
              content: JSON.stringify({
                text: '这个消息不匹配'
              })
            }
          }],
          has_more: true,
          page_token: 'next_token'
        }
      })
      .mockResolvedValueOnce({
        code: 0,
        data: {
          items: [{
            message_id: 'om_match',
            msg_type: 'text',
            create_time: '1775578710000',
            update_time: '1775578710000',
            deleted: false,
            updated: false,
            chat_id: 'chat_1',
            sender: {
              id: 'ou_2',
              id_type: 'open_id',
              sender_type: 'user',
              tenant_key: 'tenant_1'
            },
            body: {
              content: JSON.stringify({
                text: '刚刚我们在聊 README.md 的发送链路'
              })
            }
          }],
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

    try {
      const { createLarkMcpService } = await import('#~/mcp/service.js')
      const service = createLarkMcpService({
        appId: 'app_id',
        appSecret: 'app_secret',
        domain: 'Feishu',
        channelId: 'chat_1'
      })

      const result = await service.getCurrentChatMessages({
        limit: 1,
        query: '刚刚',
        lookbackMinutes: 5,
        includeRawContent: true
      })

      expect(list).toHaveBeenNthCalledWith(1, {
        params: {
          container_id: 'chat_1',
          container_id_type: 'chat',
          start_time: '1775607300',
          sort_type: 'ByCreateTimeDesc',
          page_size: 20,
          page_token: undefined
        }
      })
      expect(list).toHaveBeenNthCalledWith(2, {
        params: {
          container_id: 'chat_1',
          container_id_type: 'chat',
          start_time: '1775607300',
          sort_type: 'ByCreateTimeDesc',
          page_size: 20,
          page_token: 'next_token'
        }
      })
      expect(result).toMatchObject({
        scannedCount: 2,
        matchedCount: 1,
        hasMore: false,
        messages: [{
          messageId: 'om_match',
          text: '刚刚我们在聊 README.md 的发送链路',
          rawContent: JSON.stringify({
            text: '刚刚我们在聊 README.md 的发送链路'
          })
        }]
      })
    } finally {
      vi.useRealTimers()
    }
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
