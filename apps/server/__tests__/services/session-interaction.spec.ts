import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleChannelSessionEvent } from '#~/channels/index.js'
import { getDb } from '#~/db/index.js'
import { handleInteractionResponse, requestInteraction } from '#~/services/session/interaction.js'
import { updateAndNotifySession } from '#~/services/session/index.js'
import { adapterSessionStore, createSessionConnectionState, externalSessionStore } from '#~/services/session/runtime.js'

vi.mock('#~/channels/index.js', () => ({
  handleChannelSessionEvent: vi.fn(async () => true)
}))

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/services/session/index.js', () => ({
  updateAndNotifySession: vi.fn()
}))

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn()
  }))
}))

describe('session interaction service', () => {
  const getChannelSessionBySessionId = vi.fn()
  const getSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    adapterSessionStore.clear()
    externalSessionStore.clear()

    getChannelSessionBySessionId.mockReturnValue(undefined)
    getSession.mockReturnValue({
      id: 'sess-1',
      status: 'running'
    })

    vi.mocked(getDb).mockReturnValue({
      getChannelSessionBySessionId,
      getSession
    } as any)
  })

  it('accepts interaction requests for channel-bound sessions without websocket sockets', async () => {
    const runtime = createSessionConnectionState()
    const adapterRuntime = Object.assign(runtime, {
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })
    adapterSessionStore.set('sess-1', adapterRuntime as any)
    getChannelSessionBySessionId.mockReturnValue({
      channelType: 'lark',
      channelId: 'chat_1',
      sessionId: 'sess-1'
    })

    const interactionPromise = requestInteraction({
      sessionId: 'sess-1',
      question: '晚上吃了什么？',
      options: [
        { label: '米饭' },
        { label: '面条' }
      ]
    })

    const interactionId = adapterRuntime.currentInteraction?.id
    expect(interactionId).toBeTruthy()
    expect(vi.mocked(handleChannelSessionEvent)).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      type: 'interaction_request',
      id: interactionId
    }))
    await Promise.resolve()
    expect(vi.mocked(updateAndNotifySession)).toHaveBeenCalledWith('sess-1', { status: 'waiting_input' })

    handleInteractionResponse('sess-1', interactionId!, '米饭')

    await expect(interactionPromise).resolves.toBe('米饭')
    expect(vi.mocked(updateAndNotifySession)).toHaveBeenLastCalledWith('sess-1', { status: 'running' })
  })

  it('rejects interaction requests when neither websocket nor channel delivery is available', async () => {
    const runtime = createSessionConnectionState()
    adapterSessionStore.set('sess-1', {
      ...runtime,
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    } as any)

    await expect(requestInteraction({
      sessionId: 'sess-1',
      question: '还在吗？'
    })).rejects.toThrow('Session sess-1 is not active')
  })

  it('rejects interaction requests when the bound channel cannot actually deliver them', async () => {
    const runtime = createSessionConnectionState()
    const adapterRuntime = Object.assign(runtime, {
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })
    adapterSessionStore.set('sess-1', adapterRuntime as any)
    getChannelSessionBySessionId.mockReturnValue({
      channelType: 'lark',
      channelId: 'chat_1',
      sessionId: 'sess-1'
    })
    vi.mocked(handleChannelSessionEvent).mockResolvedValueOnce(false)

    await expect(requestInteraction({
      sessionId: 'sess-1',
      question: '晚上吃了什么？'
    })).rejects.toThrow('Session sess-1 is not active')

    expect(adapterRuntime.currentInteraction).toBeUndefined()
    expect(vi.mocked(updateAndNotifySession)).not.toHaveBeenCalledWith('sess-1', { status: 'waiting_input' })
  })
})
