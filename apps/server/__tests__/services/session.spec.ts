import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { killSession, processUserMessage } from '#~/services/session/index.js'
import { maybeNotifySession } from '#~/services/session/notification.js'
import { adapterSessionStore, externalSessionStore, notifySessionUpdated } from '#~/services/session/runtime.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/channels/index.js', () => ({
  handleChannelSessionEvent: vi.fn()
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

vi.mock('#~/services/session/notification.js', () => ({
  maybeNotifySession: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('session service', () => {
  const saveMessage = vi.fn()
  const getMessages = vi.fn()
  const updateSession = vi.fn()
  let currentSession: any

  beforeEach(() => {
    vi.clearAllMocks()
    adapterSessionStore.clear()
    externalSessionStore.clear()

    currentSession = {
      id: 'sess-1',
      title: 'New Session',
      status: 'idle',
      createdAt: Date.now(),
      messageCount: 0
    }

    updateSession.mockImplementation((_id: string, updates: Record<string, unknown>) => {
      currentSession = { ...currentSession, ...updates }
    })

    vi.mocked(getDb).mockReturnValue({
      saveMessage,
      getMessages,
      getSession: vi.fn(() => currentSession),
      getSessionRuntimeState: vi.fn(() => ({
        runtimeKind: 'interactive',
        historySeedPending: false
      })),
      updateSession
    } as any)
  })

  it('processes user messages through the active adapter session cache', async () => {
    const socket = { readyState: 1, send: vi.fn() } as any
    const emit = vi.fn()
    const messageHistory = [
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'previous',
          createdAt: 1
        }
      } as any
    ]
    getMessages.mockReturnValue(messageHistory)

    adapterSessionStore.set('sess-1', {
      session: {
        emit,
        kill: vi.fn()
      } as any,
      sockets: new Set([socket]),
      messages: messageHistory
    })

    await processUserMessage('sess-1', 'hello world')

    expect(saveMessage).toHaveBeenCalledOnce()
    expect(saveMessage).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({
          role: 'user',
          content: 'hello world'
        })
      })
    )
    expect(updateSession).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        title: 'hello world',
        lastMessage: 'hello world',
        lastUserMessage: 'hello world',
        status: 'running'
      })
    )
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        status: 'running',
        title: 'hello world'
      })
    )
    expect(vi.mocked(maybeNotifySession)).toHaveBeenCalledWith(
      'idle',
      'running',
      expect.objectContaining({ status: 'running' })
    )
    expect(socket.send).toHaveBeenCalledOnce()
    expect(String(vi.mocked(socket.send).mock.calls[0][0])).toContain('"type":"message"')
    expect(emit).toHaveBeenCalledWith({
      type: 'message',
      content: [{ type: 'text', text: 'hello world' }],
      parentUuid: 'assistant-1'
    })
  })

  it('kills active sessions and updates the persisted status', () => {
    const kill = vi.fn()

    adapterSessionStore.set('sess-1', {
      session: {
        emit: vi.fn(),
        kill
      } as any,
      sockets: new Set(),
      messages: []
    })

    killSession('sess-1')

    expect(kill).toHaveBeenCalledOnce()
    expect(adapterSessionStore.has('sess-1')).toBe(false)
    expect(updateSession).toHaveBeenCalledWith('sess-1', { status: 'terminated' })
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        status: 'terminated'
      })
    )
  })
})
