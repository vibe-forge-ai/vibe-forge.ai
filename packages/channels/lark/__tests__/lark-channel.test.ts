import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'

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
      EventDispatcher: vi.fn(),
      withTenantToken: vi.fn()
    }))

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const connection = await createChannelConnection(config)
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
      EventDispatcher,
      withTenantToken: vi.fn()
    }))

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const handler = vi.fn()
    const connection = await createChannelConnection(config)
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
      sessionType: 'direct',
      channelId: 'oc_xxx',
      senderId: 'ou_xxx',
      messageId: 'om_xxx',
      text: '[ou_xxx]:\nping'
    }))
  })

  it('formats mentions and strips url backticks', async () => {
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
      EventDispatcher,
      withTenantToken: vi.fn()
    }))

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const handler = vi.fn()
    const connection = await createChannelConnection(config)
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
        chat_type: 'group',
        content: JSON.stringify({
          text: '@_user_1 /reset @_user_2 hi `https://example.com/wiki/abc`'
        }),
        mentions: [
          {
            id: { open_id: 'ou_1' },
            key: '@_user_1',
            name: '二介'
          },
          {
            id: { open_id: 'ou_2' },
            key: '@_user_2',
            name: '奉自利'
          }
        ],
        message_id: 'om_xxx'
      },
      sender: {
        sender_id: {
          open_id: 'ou_sender'
        }
      }
    })

    expect(wsStart).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      text:
        '[ou_sender]:\n<at type="lark" user_id="ou_1">二介</at> /reset <at type="lark" user_id="ou_2">奉自利</at> hi https://example.com/wiki/abc'
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
      EventDispatcher: vi.fn(),
      withTenantToken: vi.fn()
    }))

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const connection = await createChannelConnection(config)

    await expect(connection.sendMessage({ text: 'hello', receiveId: 'oc_xxx', receiveIdType: 'chat_id' }))
      .rejects
      .toThrow('Lark message send failed: bad')
  })

  it('parses rich content and downloads images as base64', async () => {
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
    const imageGet = vi.fn().mockResolvedValue({
      getReadableStream: () => Readable.from([Buffer.from('fake-png')]),
      headers: { 'content-type': 'image/png' },
      writeFile: vi.fn()
    })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        v1: {
          image: {
            get: imageGet
          }
        }
      }
    }))
    const withTenantToken = vi.fn().mockReturnValue({})
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        msg: 'ok',
        tenant_access_token: 't_xxx',
        expire: 7200
      })
    })

    vi.doMock('@larksuiteoapi/node-sdk', () => ({
      Client,
      Domain: { Feishu: 'Feishu' },
      WSClient,
      EventDispatcher,
      withTenantToken
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const handler = vi.fn()
    const connection = await createChannelConnection(config)
    await connection.startReceiving?.({
      handlers: {
        message: handler
      }
    })

    const dispatcher = EventDispatcher.mock.results[0]?.value as MockDispatcher | undefined
    const imageKey = 'img_v3_02vo_8bd8c033-b6de-428a-a36c-d5927ad653bg'
    await dispatcher?.handlers['im.message.receive_v1']?.({
      event_type: 'im.message.receive_v1',
      message: {
        chat_id: 'oc_xxx',
        chat_type: 'group',
        content: JSON.stringify({
          title: '',
          content: [
            [
              [
                {
                  tag: 'at',
                  user_id: '@_user_1',
                  user_name: '二介',
                  style: []
                },
                {
                  tag: 'text',
                  text: ' 你好',
                  style: []
                }
              ],
              [
                {
                  tag: 'img',
                  image_key: imageKey,
                  width: 316,
                  height: 160
                }
              ]
            ]
          ]
        }),
        mentions: [
          {
            id: { open_id: 'ou_1' },
            key: '@_user_1',
            name: '二介'
          }
        ],
        message_id: 'om_xxx'
      },
      sender: {
        sender_id: {
          open_id: 'ou_sender'
        }
      }
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fsopen.bytedance.net/open-apis/auth/v3/tenant_access_token/internal',
      expect.objectContaining({
        method: 'POST'
      })
    )
    expect(withTenantToken).toHaveBeenCalledWith('t_xxx')
    expect(imageGet).toHaveBeenCalledWith({
      path: { image_key: imageKey }
    }, {})
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      text: `[ou_sender]:\n<at type="lark" user_id="ou_1">二介</at> 你好\n<img image_key="${imageKey}" />`,
      raw: expect.objectContaining({
        contentItems: expect.any(Array),
        images: expect.any(Array)
      })
    }))
    const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value != null
    const call0 = handler.mock.calls[0]?.[0] as unknown
    const raw = isRecord(call0) ? call0.raw : undefined
    const contentItems = isRecord(raw) ? raw.contentItems : undefined
    expect(Array.isArray(contentItems)).toBe(true)
    if (Array.isArray(contentItems)) {
      expect(contentItems.some(i =>
        isRecord(i) &&
        i.type === 'image' &&
        typeof i.url === 'string' &&
        i.url.startsWith('data:image/png;base64,')
      )).toBe(true)
    }
    vi.unstubAllGlobals()
  })
})
