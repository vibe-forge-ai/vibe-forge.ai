import { describe, expect, it, vi } from 'vitest'

describe('lark channel message lifecycle tools', () => {
  it('replies to, updates, patches, and pushes follow-ups on messages', async () => {
    vi.resetModules()
    const reply = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_reply'
      }
    })
    const update = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message_id: 'om_update'
      }
    })
    const patch = vi.fn().mockResolvedValue({
      code: 0,
      data: {}
    })
    const pushFollowUp = vi.fn().mockResolvedValue({
      code: 0,
      data: {}
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            reply,
            update,
            patch,
            pushFollowUp
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

    expect(await service.replyMessage({
      messageId: 'om_source',
      msgType: 'text',
      content: { text: 'reply' },
      replyInThread: true
    })).toEqual({
      sourceMessageId: 'om_source',
      msgType: 'text',
      messageId: 'om_reply'
    })

    expect(reply).toHaveBeenCalledWith({
      path: { message_id: 'om_source' },
      data: {
        msg_type: 'text',
        content: JSON.stringify({ text: 'reply' }),
        reply_in_thread: true,
        uuid: undefined
      }
    })

    expect(await service.updateMessage({
      messageId: 'om_update',
      msgType: 'text',
      content: { text: 'updated' }
    })).toEqual({
      messageId: 'om_update',
      msgType: 'text'
    })

    expect(update).toHaveBeenCalledWith({
      path: { message_id: 'om_update' },
      data: {
        msg_type: 'text',
        content: JSON.stringify({ text: 'updated' })
      }
    })

    expect(await service.patchMessage({
      messageId: 'om_card',
      content: { elements: [] }
    })).toEqual({})

    expect(patch).toHaveBeenCalledWith({
      path: { message_id: 'om_card' },
      data: {
        content: JSON.stringify({ elements: [] })
      }
    })

    expect(await service.pushFollowUps({
      messageId: 'om_card',
      followUps: [{
        content: 'next step',
        i18nContents: [{
          content: 'next step',
          language: 'en_us'
        }]
      }]
    })).toEqual({})

    expect(pushFollowUp).toHaveBeenCalledWith({
      path: { message_id: 'om_card' },
      data: {
        follow_ups: [{
          content: 'next step',
          i18n_contents: [{
            content: 'next step',
            language: 'en_us'
          }]
        }]
      }
    })
  })

  it('lists read users for a bot-sent message', async () => {
    vi.resetModules()
    const readUsers = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        items: [{ user_id: 'ou_1' }],
        has_more: false
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            readUsers
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

    const result = await service.getMessageReadUsers({
      messageId: 'om_read',
      pageSize: 20
    })

    expect(readUsers).toHaveBeenCalledWith({
      path: { message_id: 'om_read' },
      params: {
        user_id_type: 'open_id',
        page_size: 20,
        page_token: undefined
      }
    })
    expect(result).toEqual({
      items: [{ user_id: 'ou_1' }],
      has_more: false
    })
  })

  it('rejects unsupported message types for updateMessage before calling the SDK', async () => {
    vi.resetModules()
    const update = vi.fn()

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            update
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

    await expect(service.updateMessage({
      messageId: 'om_update',
      msgType: 'interactive' as never,
      content: { card: {} }
    })).rejects.toThrow('Update message only supports msgType "text" or "post".')
    expect(update).not.toHaveBeenCalled()
  })
})
