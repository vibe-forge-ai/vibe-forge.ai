import { describe, expect, it, vi } from 'vitest'

describe('lark channel advanced tools', () => {
  it('merge-forwards multiple messages to the bound chat', async () => {
    vi.resetModules()
    const mergeForward = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        message: {
          message_id: 'om_merge'
        },
        invalid_message_id_list: []
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            mergeForward
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

    const result = await service.mergeForwardMessages({
      messageIds: ['om_1', 'om_2']
    })

    expect(mergeForward).toHaveBeenCalledWith({
      params: {
        receive_id_type: 'chat_id',
        uuid: undefined
      },
      data: {
        receive_id: 'chat_1',
        message_id_list: ['om_1', 'om_2']
      }
    })
    expect(result).toEqual({
      message: {
        message_id: 'om_merge'
      },
      invalid_message_id_list: []
    })
  })

  it('sends app urgent for a bot-sent message', async () => {
    vi.resetModules()
    const urgentApp = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        invalid_user_id_list: []
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            urgentApp
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

    const result = await service.sendAppUrgent({
      messageId: 'om_urgent',
      userIds: ['ou_1']
    })

    expect(urgentApp).toHaveBeenCalledWith({
      path: {
        message_id: 'om_urgent'
      },
      params: {
        user_id_type: 'open_id'
      },
      data: {
        user_id_list: ['ou_1']
      }
    })
    expect(result).toEqual({
      invalid_user_id_list: []
    })
  })

  it('creates a chat with an initial user list', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        chat_id: 'chat_new'
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          chat: {
            create
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

    const result = await service.createChat({
      name: 'Launch Room',
      userIdList: ['ou_1'],
      setBotManager: true
    })

    expect(create).toHaveBeenCalledWith({
      params: {
        user_id_type: undefined,
        set_bot_manager: true,
        uuid: undefined
      },
      data: {
        name: 'Launch Room',
        description: undefined,
        owner_id: undefined,
        user_id_list: ['ou_1'],
        bot_id_list: undefined,
        group_message_type: undefined,
        external: undefined
      }
    })
    expect(result).toEqual({
      chat_id: 'chat_new'
    })
  })

  it('updates the bound chat metadata by default', async () => {
    vi.resetModules()
    const update = vi.fn().mockResolvedValue({
      code: 0,
      data: {}
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          chat: {
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
      domain: 'Feishu',
      channelId: 'chat_1'
    })

    const result = await service.updateChat({
      name: 'New Name'
    })

    expect(update).toHaveBeenCalledWith({
      path: {
        chat_id: 'chat_1'
      },
      params: {
        user_id_type: undefined
      },
      data: {
        name: 'New Name',
        description: undefined,
        owner_id: undefined,
        add_member_permission: undefined,
        share_card_permission: undefined,
        at_all_permission: undefined,
        edit_permission: undefined,
        join_message_visibility: undefined,
        leave_message_visibility: undefined,
        membership_approval: undefined,
        group_message_type: undefined,
        urgent_setting: undefined,
        video_conference_setting: undefined,
        pin_manage_setting: undefined,
        hide_member_count_setting: undefined
      }
    })
    expect(result).toEqual({})
  })

  it('requires explicit acknowledgement before sending quota-consuming urgent messages', async () => {
    vi.resetModules()
    const urgentSms = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        invalid_user_id_list: []
      }
    })
    const urgentPhone = vi.fn().mockResolvedValue({
      code: 0,
      data: {
        invalid_user_id_list: []
      }
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          message: {
            urgentSms,
            urgentPhone
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

    await expect(service.sendSmsUrgent({
      messageId: 'om_sms',
      userIds: ['ou_1']
    } as never)).rejects.toThrow('Send SMS urgent requires confirmQuotaUsage=true.')
    await expect(service.sendPhoneUrgent({
      messageId: 'om_phone',
      userIds: ['ou_1']
    } as never)).rejects.toThrow('Send phone urgent requires confirmQuotaUsage=true.')
    expect(urgentSms).not.toHaveBeenCalled()
    expect(urgentPhone).not.toHaveBeenCalled()

    await expect(service.sendSmsUrgent({
      messageId: 'om_sms',
      userIds: ['ou_1'],
      confirmQuotaUsage: true
    })).resolves.toEqual({
      invalid_user_id_list: []
    })
    await expect(service.sendPhoneUrgent({
      messageId: 'om_phone',
      userIds: ['ou_1'],
      confirmQuotaUsage: true
    })).resolves.toEqual({
      invalid_user_id_list: []
    })
  })

  it('requires an explicit chatId and confirmation before deleting a chat', async () => {
    vi.resetModules()
    const deleteChat = vi.fn().mockResolvedValue({
      code: 0,
      data: {}
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn().mockImplementation(() => ({
        im: {
          chat: {
            delete: deleteChat
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
      channelId: 'chat_bound'
    })

    await expect(service.deleteChat({
      chatId: 'chat_bound'
    } as never)).rejects.toThrow('Delete chat requires confirmDelete=true.')
    expect(deleteChat).not.toHaveBeenCalled()

    await expect(service.deleteChat({
      chatId: 'chat_explicit',
      confirmDelete: true
    })).resolves.toEqual({})
    expect(deleteChat).toHaveBeenCalledWith({
      path: {
        chat_id: 'chat_explicit'
      }
    })
  })
})
