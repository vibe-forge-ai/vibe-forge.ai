import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import type { LarkChannelConfig } from '#~/index.js'

describe('larkChannelDefinition.connect', () => {
  it('sends message using lark sdk', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_sent' } })
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
      .resolves
      .toEqual({ messageId: 'om_sent' })

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

  it('renders tool summaries as interactive cards', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_card' } })
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await expect(connection.sendMessage({
      text: '工具调用（1）\n1. SendImage',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id',
      toolCallSummary: {
        items: [{
          toolUseId: 'tool-1',
          name: 'mcp__channel-lark-test__SendImage',
          status: 'success',
          argsText: '{"imagePath":"packages/utils/src/assets/mcp.png"}',
          resultText: '{"messageId":"om_image"}',
          detailUrl: 'http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1',
          exportJsonUrl: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1'
        }]
      }
    })).resolves.toEqual({ messageId: 'om_card' })

    const payload = create.mock.calls[0]?.[0]
    expect(payload).toEqual(expect.objectContaining({
      params: { receive_id_type: 'chat_id' },
      data: expect.objectContaining({
        receive_id: 'oc_xxx',
        msg_type: 'interactive'
      })
    }))

    const card = JSON.parse(payload.data.content)
    expect(card.schema).toBe('2.0')
    expect(card.config.update_multi).toBe(true)
    expect(card.header.title.content).toBe('工具调用（1）')
    expect(card.body.elements[0].tag).toBe('collapsible_panel')
    expect(card.body.elements[0].expanded).toBe(false)
    expect(card.body.elements[0].header.title.content)
      .toContain('✅ SendImage({"imagePath":"packages/utils/src/assets/mcp.png"})')
    expect(card.body.elements[0].elements[0].content).toContain('**传入参数**')
    expect(card.body.elements[0].elements[0].content).toContain('```json')
    expect(card.body.elements[0].elements[0].content).toContain('"imagePath": "packages/utils/src/assets/mcp.png"')
    expect(card.body.elements[0].elements[1].content).toContain('**执行结果**')
    expect(card.body.elements[0].elements[1].content).toContain('"messageId": "om_image"')
    expect(card.body.elements[0].elements[2].content).toContain(
      '[在 Server 中查看工具调用详情](http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1)'
    )
  })

  it('updates tool summary cards in place', async () => {
    vi.resetModules()
    const patch = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_card' } })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        message: {
          create: vi.fn(),
          patch,
          update: vi.fn()
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await expect(connection.updateMessage?.('om_card', {
      text: '工具调用（1）\n1. SendImage',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id',
      toolCallSummary: {
        items: [{
          toolUseId: 'tool-1',
          name: 'mcp__channel-lark-test__SendImage',
          status: 'success',
          argsText: '{"imagePath":"a.png"}',
          resultText: '{"messageId":"om_image"}',
          detailUrl: 'http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1',
          exportJsonUrl: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1'
        }]
      }
    })).resolves.toEqual({ messageId: 'om_card' })

    expect(patch).toHaveBeenCalledWith({
      path: {
        message_id: 'om_card'
      },
      data: {
        content: expect.any(String)
      }
    })

    const payload = patch.mock.calls[0]?.[0]
    const card = JSON.parse(payload.data.content)
    expect(card.schema).toBe('2.0')
    expect(card.body.elements[0].header.title.content).toContain('✅ SendImage({"imagePath":"a.png"})')
    expect(card.body.elements[0].elements[1].content).toContain('"messageId": "om_image"')
    expect(card.body.elements[0].elements[2].content).toContain('toolUseId=tool-1')
  })

  it('hides long string params in the header and keeps full args in the expanded body', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_card' } })
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    const longPrompt = 'x'.repeat(120)
    await connection.sendMessage({
      text: '工具调用（1）\n1. SendRawMessage',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id',
      toolCallSummary: {
        items: [{
          toolUseId: 'tool-1',
          name: 'mcp__channel-lark-test__SendRawMessage',
          status: 'success',
          argsText: JSON.stringify({ prompt: longPrompt }),
          resultText: JSON.stringify({ ok: true })
        }]
      }
    })

    const payload = create.mock.calls[0]?.[0]
    const card = JSON.parse(payload.data.content)
    expect(card.body.elements[0].header.title.content).toContain('✅ SendRawMessage({"prompt":"..."})')
    expect(card.body.elements[0].elements[0].content).toContain(`"prompt": "${longPrompt}"`)
  })

  it('truncates long results and renders an export button instead of paging controls', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_card' } })
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await connection.sendMessage({
      text: '工具调用（1）\n1. GetCurrentChatMessages',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id',
      toolCallSummary: {
        items: [{
          toolUseId: 'tool-1',
          name: 'mcp__channel-lark-test__GetCurrentChatMessages',
          status: 'success',
          argsText: '{"limit":50}',
          resultText: JSON.stringify({
            items: Array.from({ length: 30 }, (_, index) => ({ index }))
          }),
          exportJsonUrl: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1'
        }]
      }
    })

    const payload = create.mock.calls[0]?.[0]
    const card = JSON.parse(payload.data.content)
    expect(card.body.elements[0].elements[1].content).toContain('\n...\n```')
    expect(card.body.elements[0].elements[2]).toEqual(expect.objectContaining({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: '发送完整 JSON 文件'
      },
      url: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1'
    }))
  })

  it('uploads and sends file messages through the lark api', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_file' } })
    const fileCreate = vi.fn().mockResolvedValue({ code: 0, file_key: 'file_key_1' })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        file: {
          create: fileCreate
        },
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await expect(connection.sendFileMessage?.({
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id',
      fileName: 'tool-call.json',
      content: JSON.stringify({ ok: true }, null, 2)
    })).resolves.toEqual({ messageId: 'om_file' })

    expect(fileCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        file_type: 'stream',
        file_name: 'tool-call.json',
        file: expect.any(Buffer)
      })
    }))
    expect(create).toHaveBeenCalledWith({
      params: {
        receive_id_type: 'chat_id'
      },
      data: {
        receive_id: 'oc_xxx',
        msg_type: 'file',
        content: JSON.stringify({ file_key: 'file_key_1' })
      }
    })
  })

  it('renders markdown-like normal messages as post messages instead of cards', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_post' } })
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await expect(connection.sendMessage({
      text: '# 标题\n- item1\n- item2\n```ts\nconsole.log(1)\n```',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id'
    })).resolves.toEqual({ messageId: 'om_post' })

    expect(create).toHaveBeenCalledWith({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: 'oc_xxx',
        msg_type: 'post',
        content: JSON.stringify({
          zh_cn: {
            content: [[{
              tag: 'md',
              text: '# 标题\n- item1\n- item2\n```ts\nconsole.log(1)\n```'
            }]]
          }
        })
      }
    })
  })

  it('keeps plain normal messages as text', async () => {
    vi.resetModules()
    const create = vi.fn().mockResolvedValue({ code: 0, data: { message_id: 'om_text' } })
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

    const connection = await createChannelConnection({
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    })

    await connection.sendMessage({
      text: '收到，链路正常。',
      receiveId: 'oc_xxx',
      receiveIdType: 'chat_id'
    })

    expect(create).toHaveBeenCalledWith({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: 'oc_xxx',
        msg_type: 'text',
        content: JSON.stringify({ text: '收到，链路正常。' })
      }
    })
  })

  it('pushes follow-up bubbles through the Lark API', async () => {
    vi.resetModules()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          msg: 'ok',
          tenant_access_token: 't_xxx',
          expire: 7200
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, msg: 'success', data: {} })
      })
    const Client = vi.fn().mockImplementation(() => ({
      im: {
        message: {
          create: vi.fn()
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
    vi.stubGlobal('fetch', fetchMock)

    const { createChannelConnection } = await import('#~/connection.js')

    const config: LarkChannelConfig = {
      type: 'lark',
      appId: 'app_id',
      appSecret: 'app_secret'
    }

    const connection = await createChannelConnection(config)
    await connection.pushFollowUps?.({
      messageId: 'om_target',
      followUps: [
        { content: '/help --page=1' },
        { content: '/help --page=2' }
      ]
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fsopen.bytedance.net/open-apis/im/v1/messages/om_target/push_follow_up',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer t_xxx',
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          follow_ups: [
            { content: '/help --page=1', i18n_contents: undefined },
            { content: '/help --page=2', i18n_contents: undefined }
          ]
        })
      }
    )
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
