/* eslint-disable max-lines */

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
    updateMessage?: ReturnType<typeof vi.fn>
    pushFollowUps?: ReturnType<typeof vi.fn>
    language?: 'zh' | 'en'
  } = {}
) =>
  new Map([
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
        updateMessage: input.updateMessage,
        pushFollowUps: input.pushFollowUps ?? vi.fn().mockResolvedValue(undefined)
      }
    } as any]
  ])

const makeInteractionRequestEvent = (
  payload: Record<string, unknown>,
  id = 'interaction-1'
) =>
  ({
    type: 'interaction_request',
    id,
    payload: {
      sessionId: 'sess-1',
      ...payload
    }
  }) as any

const makeMessageEvent = (
  role: 'assistant' | 'user',
  content: any,
  id = `msg_${Math.random().toString(36).slice(2)}`
) =>
  ({
    type: 'message',
    message: {
      id,
      role,
      content,
      createdAt: Date.now()
    }
  }) as any

const expectActionUrl = async (
  input: {
    url: string
    action: 'tool-call-detail' | 'tool-call-export'
    claims: Record<string, unknown>
  }
) => {
  const { verifyChannelActionToken } = await import('#~/channels/action-token.js')
  const parsed = new URL(input.url)
  expect(`${parsed.origin}${parsed.pathname}`).toBe(`http://localhost:8787/channels/actions/${input.action}`)
  expect(verifyChannelActionToken(parsed.searchParams.get('token') ?? '', input.action)).toEqual({
    ok: true,
    claims: expect.objectContaining(input.claims)
  })
}

describe('channel handlers', () => {
  beforeEach(() => {
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    deleteBinding('sess-1')
    consumePendingUnack('sess-1')
  })

  afterEach(() => {
    deleteBinding('sess-1')
    consumePendingUnack('sess-1')
    vi.unstubAllEnvs()
    vi.resetModules()
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
          reasons: ['Write requires approval'],
          subjectKey: 'Write',
          subjectLabel: 'Write',
          scope: 'tool',
          projectConfigPath: '.ai.config.json'
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
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('审批范围：Write')
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('项目记忆文件：.ai.config.json')
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('Write requires approval')
    expect(pushFollowUps).toHaveBeenCalledWith({
      messageId: 'om_permission',
      followUps: [
        { content: 'dontAsk' },
        { content: 'cancel' }
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

  it('delivers the first tool event immediately and updates the same summary message as results arrive', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    const updateMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    bindTestSession()

    await expect(handleSessionEvent(
      makeRuntimeState({ sendMessage, updateMessage }),
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-1',
        name: 'mcp__channel-lark-test__SendImage',
        input: {
          imagePath: 'packages/utils/src/assets/mcp.png'
        }
      }], 'assistant-tool-use')
    )).resolves.toBe(true)

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      toolCallSummary: expect.objectContaining({
        items: [expect.objectContaining({
          toolUseId: 'tool-1',
          name: 'SendImage',
          status: 'pending',
          argsText: '{"imagePath":"packages/utils/src/assets/mcp.png"}'
        })]
      })
    }))
    const firstItem = sendMessage.mock.calls[0]?.[0]?.toolCallSummary?.items?.[0]
    await expectActionUrl({
      url: firstItem.detailUrl,
      action: 'tool-call-detail',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        messageId: 'assistant-tool-use',
        oneTime: false
      }
    })
    await expectActionUrl({
      url: firstItem.exportJsonUrl,
      action: 'tool-call-export',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        messageId: 'assistant-tool-use',
        oneTime: true
      }
    })

    await expect(handleSessionEvent(
      makeRuntimeState({ sendMessage, updateMessage }),
      'sess-1',
      makeMessageEvent('user', [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: {
          messageId: 'om_lark_image'
        }
      }], 'user-tool-result')
    )).resolves.toBe(true)

    expect(updateMessage).toHaveBeenCalledTimes(1)
    expect(updateMessage).toHaveBeenCalledWith(
      'om_tool_summary',
      expect.objectContaining({
        toolCallSummary: expect.objectContaining({
          items: [expect.objectContaining({
            toolUseId: 'tool-1',
            status: 'success',
            resultText: '{"messageId":"om_lark_image"}'
          })]
        })
      })
    )

    await expect(handleSessionEvent(
      makeRuntimeState({ sendMessage, updateMessage }),
      'sess-1',
      makeMessageEvent('assistant', '图片已发送。', 'assistant-final')
    )).resolves.toBe(true)

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      receiveId: 'chat_1',
      receiveIdType: 'chat_id',
      text: '图片已发送。'
    })
  })

  it('keeps adjacent tool calls inside one updatable summary card', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    const updateMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    bindTestSession()
    const states = makeRuntimeState({ sendMessage, updateMessage })

    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-1',
        name: 'mcp__channel-lark-test__SendImage',
        input: { imagePath: 'a.png' }
      }], 'tool-1-use')
    )
    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('user', [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: { messageId: 'om_image' }
      }], 'tool-1-result')
    )
    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-2',
        name: 'mcp__channel-lark-test__SendFile',
        input: { filePath: 'README.md' }
      }], 'tool-2-use')
    )
    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('user', [{
        type: 'tool_result',
        tool_use_id: 'tool-2',
        content: { messageId: 'om_file' }
      }], 'tool-2-result')
    )

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(updateMessage).toHaveBeenCalledTimes(3)
    expect(updateMessage.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      toolCallSummary: expect.objectContaining({
        items: [
          expect.objectContaining({
            toolUseId: 'tool-1',
            status: 'success',
            resultText: '{"messageId":"om_image"}'
          }),
          expect.objectContaining({
            toolUseId: 'tool-2',
            name: 'SendFile',
            status: 'success',
            argsText: '{"filePath":"README.md"}',
            resultText: '{"messageId":"om_file"}'
          })
        ]
      })
    }))
    const finalItems = updateMessage.mock.calls[2]?.[1]?.toolCallSummary?.items ?? []
    const sendFileItem = finalItems.find((item: any) => item.toolUseId === 'tool-2')
    await expectActionUrl({
      url: sendFileItem.detailUrl,
      action: 'tool-call-detail',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-2',
        messageId: 'tool-2-result',
        oneTime: false
      }
    })
    await expectActionUrl({
      url: sendFileItem.exportJsonUrl,
      action: 'tool-call-export',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-2',
        messageId: 'tool-2-result',
        oneTime: true
      }
    })
  })

  it('keeps updating the same tool summary card after a permission interaction', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce({ messageId: 'om_tool_summary' })
      .mockResolvedValueOnce({ messageId: 'om_permission' })
    const updateMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    bindTestSession()
    const states = makeRuntimeState({ sendMessage, updateMessage })

    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-1',
        name: 'mcp__channel-lark-test__GetCurrentChatMessages',
        input: { chatId: '', limit: 6 }
      }], 'tool-1-use')
    )

    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'Claude requested permissions to use mcp__channel-lark-test__GetCurrentChatMessages.',
        is_error: true
      }], 'tool-1-result')
    )

    await handleSessionEvent(
      states,
      'sess-1',
      makeInteractionRequestEvent({
        kind: 'permission',
        question: '当前任务需要使用 channel-lark-test 才能继续，请选择处理方式。',
        options: [
          { label: '同意本次', value: 'allow_once' }
        ]
      }, 'interaction-permission')
    )

    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-2',
        name: 'mcp__channel-lark-test__GetCurrentChatMessages',
        input: { chatId: '', limit: 6 }
      }], 'tool-2-use')
    )

    await handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_result',
        tool_use_id: 'tool-2',
        content: {
          matchedCount: 6
        }
      }], 'tool-2-result')
    )

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        receiveId: 'chat_1',
        receiveIdType: 'chat_id',
        toolCallSummary: expect.any(Object)
      })
    )
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        receiveId: 'chat_1',
        receiveIdType: 'chat_id',
        text: expect.stringContaining('[权限请求]')
      })
    )
    expect(updateMessage).toHaveBeenCalledTimes(3)
    expect(updateMessage.mock.calls[2]?.[0]).toBe('om_tool_summary')
    expect(updateMessage.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      toolCallSummary: expect.objectContaining({
        items: [
          expect.objectContaining({
            toolUseId: 'tool-1',
            status: 'error'
          }),
          expect.objectContaining({
            toolUseId: 'tool-2',
            status: 'success',
            resultText: '{"matchedCount":6}'
          })
        ]
      })
    }))
  })

  it('serializes tool summary upserts so fast tool results patch the first card instead of sending a second one', async () => {
    let resolveSendMessage: ((value: { messageId: string }) => void) | undefined
    const sendMessage = vi.fn().mockImplementation(async () => {
      return await new Promise<{ messageId: string }>((resolve) => {
        resolveSendMessage = resolve
      })
    })
    const updateMessage = vi.fn().mockResolvedValue({ messageId: 'om_tool_summary' })
    bindTestSession()
    const states = makeRuntimeState({ sendMessage, updateMessage })

    const firstEvent = handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_use',
        id: 'tool-1',
        name: 'mcp__channel-lark-test__GetCurrentChatMessages',
        input: { chatId: '', limit: 6 }
      }], 'tool-1-use')
    )

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    const secondEvent = handleSessionEvent(
      states,
      'sess-1',
      makeMessageEvent('assistant', [{
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: {
          matchedCount: 6
        }
      }], 'tool-1-result')
    )

    expect(updateMessage).not.toHaveBeenCalled()
    resolveSendMessage?.({ messageId: 'om_tool_summary' })

    await expect(Promise.all([firstEvent, secondEvent])).resolves.toEqual([true, true])

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(updateMessage).toHaveBeenCalledTimes(1)
    expect(updateMessage).toHaveBeenCalledWith(
      'om_tool_summary',
      expect.objectContaining({
        toolCallSummary: expect.objectContaining({
          items: [expect.objectContaining({
            toolUseId: 'tool-1',
            name: 'GetCurrentChatMessages',
            status: 'success',
            argsText: '{"chatId":"","limit":6}',
            resultText: '{"matchedCount":6}'
          })]
        })
      })
    )
    const resultItem = updateMessage.mock.calls[0]?.[1]?.toolCallSummary?.items?.[0]
    await expectActionUrl({
      url: resultItem.detailUrl,
      action: 'tool-call-detail',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        messageId: 'tool-1-result',
        oneTime: false
      }
    })
    await expectActionUrl({
      url: resultItem.exportJsonUrl,
      action: 'tool-call-export',
      claims: {
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        messageId: 'tool-1-result',
        oneTime: true
      }
    })
  })
})
