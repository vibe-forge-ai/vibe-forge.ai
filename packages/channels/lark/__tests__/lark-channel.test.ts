import { describe, expect, it, vi } from 'vitest'

import type { LarkChannelConfig } from '#~/index.js'

describe('larkChannelDefinition.connect', () => {
  it('sends message using lark sdk', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0 })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        message: {
          create
        }
      }
    }))

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client,
      Domain: { Feishu: 'Feishu' },
      WSClient: vi.fn(),
      EventDispatcher: vi.fn()
    }))

    const { connectLarkChannel } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const connection = await connectLarkChannel(config)
    await connection.sendMessage({ text: 'hello', receiveId: 'oc_xxx', receiveIdType: 'chat_id' })

    expect(Client).toHaveBeenCalledWith({
      appId: 'app_id',
      appSecret: 'app_secret',
      domain: 'Feishu'
    })
    expect(create).toHaveBeenCalledWith({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: 'oc_xxx',
        msg_type: 'text',
        content: JSON.stringify({ text: 'hello' })
      }
    })
  })

  it('starts websocket receiving with handlers', async () => {
    vi.resetModules()
    const wsStart = vi.fn()
    const WSClient = vi.fn().mockImplementation(() => ({
      start: wsStart
    }))
    class MockDispatcher {
      handlers: Record<string, (payload: unknown) => Promise<void>> = {}
      register(entries: Record<string, (payload: unknown) => Promise<void>>) {
        this.handlers = { ...this.handlers, ...entries }
        return this
      }
    }
    const EventDispatcher = vi.fn().mockImplementation(() => new MockDispatcher())
    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client: vi.fn(),
      Domain: { Feishu: 'Feishu' },
      WSClient,
      EventDispatcher
    }))

    const { connectLarkChannel } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const handler = vi.fn()
    const connection = await connectLarkChannel(config)
    await connection.startReceiving?.({
      handlers: {
        message: handler
      }
    })

    const dispatcher = EventDispatcher.mock.results[0]?.value as MockDispatcher | undefined
    await dispatcher?.handlers['im.message.receive_v1']?.({
      event_type: 'im.message.receive_v1',
      message: {
        chat_id: 'oc_xxx',
        chat_type: 'p2p',
        content: JSON.stringify({ text: 'ping' }),
        message_id: 'om_xxx'
      },
      sender: {
        sender_id: {
          open_id: 'ou_xxx'
        }
      }
    })

    expect(wsStart).toHaveBeenCalledWith({
      eventDispatcher: dispatcher
    })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'lark',
      sessionType: 'p2p',
      channelId: 'oc_xxx',
      senderId: 'ou_xxx',
      messageId: 'om_xxx',
      text: 'ping'
    }))
  })

  it('throws when lark sdk returns non-zero code', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 1001, msg: 'bad' })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        message: {
          create
        }
      }
    }))

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client,
      Domain: { Feishu: 'Feishu' },
      WSClient: vi.fn(),
      EventDispatcher: vi.fn()
    }))

    const { connectLarkChannel } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const connection = await connectLarkChannel(config)

    await expect(connection.sendMessage({ text: 'hello', receiveId: 'oc_xxx', receiveIdType: 'chat_id' }))
      .rejects
      .toThrow('Lark message send failed: bad')
  })
})
