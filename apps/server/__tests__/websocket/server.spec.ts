import type { Server } from 'node:http'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const addSessionSubscriberSocket = vi.fn()
const removeSessionSubscriberSocket = vi.fn()
const attachSocketToSession = vi.fn()
const detachSocketFromSession = vi.fn()
const startAdapterSession = vi.fn()
const handleInteractionResponse = vi.fn()
const processUserMessage = vi.fn()
const interruptSession = vi.fn()
const killSession = vi.fn()
const getSession = vi.fn()

let connectionHandler: ((ws: any, req: any) => Promise<void>) | undefined

vi.mock('ws', () => {
  class MockWebSocketServer {
    constructor(_options: unknown) {}

    on(event: string, handler: (ws: any, req: any) => Promise<void>) {
      if (event === 'connection') {
        connectionHandler = handler
      }
    }
  }

  return {
    WebSocketServer: MockWebSocketServer
  }
})

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn(() => ({
    getSession
  }))
}))

vi.mock('#~/services/session/index.js', () => ({
  startAdapterSession,
  processUserMessage,
  interruptSession,
  killSession
}))

vi.mock('#~/services/session/interaction.js', () => ({
  handleInteractionResponse
}))

vi.mock('#~/services/session/runtime.js', () => ({
  addSessionSubscriberSocket,
  removeSessionSubscriberSocket,
  attachSocketToSession,
  detachSocketFromSession
}))

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn()
  }))
}))

describe('setupWebSocket', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    connectionHandler = undefined

    const { setupWebSocket } = await import('#~/websocket/server.js')
    setupWebSocket({} as Server, {
      __VF_PROJECT_AI_SERVER_WS_PATH__: '/ws'
    } as any)
  })

  it('registers session list subscribers only for subscribe=sessions connections', async () => {
    const ws = {
      on: vi.fn(),
      readyState: 1,
      send: vi.fn()
    }

    await connectionHandler?.(ws, {
      url: '/ws?subscribe=sessions',
      headers: { host: 'localhost' }
    })

    expect(addSessionSubscriberSocket).toHaveBeenCalledOnce()
    expect(addSessionSubscriberSocket).toHaveBeenCalledWith(ws)
    expect(startAdapterSession).not.toHaveBeenCalled()
    expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('does not register regular session sockets as session list subscribers', async () => {
    startAdapterSession.mockResolvedValue({ sockets: new Set(), session: {} })
    attachSocketToSession.mockReturnValue({ sockets: new Set([{}]), session: {} })
    getSession.mockReturnValue(undefined)

    const ws = {
      on: vi.fn(),
      readyState: 1,
      send: vi.fn()
    }

    await connectionHandler?.(ws, {
      url: '/ws?sessionId=sess-1',
      headers: { host: 'localhost' }
    })

    expect(addSessionSubscriberSocket).not.toHaveBeenCalled()
    expect(startAdapterSession).toHaveBeenCalledOnce()
    expect(startAdapterSession).toHaveBeenCalledWith('sess-1', {
      model: undefined,
      systemPrompt: undefined,
      appendSystemPrompt: true,
      permissionMode: undefined,
      promptType: undefined,
      promptName: undefined,
      adapter: undefined
    })
    expect(attachSocketToSession).toHaveBeenCalledWith('sess-1', ws, 'adapter')
  })
})
