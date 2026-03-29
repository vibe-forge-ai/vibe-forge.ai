import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { processUserMessage, startAdapterSession } from '#~/services/session/index.js'
import { adapterSessionStore, externalSessionStore, notifySessionUpdated } from '#~/services/session/runtime.js'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  generateAdapterQueryOptions: vi.fn(),
  loadMergedConfig: vi.fn(),
  handleChannelSessionEvent: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('@vibe-forge/app-runtime', () => ({
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions,
  run: mocks.run
}))

vi.mock('#~/channels/index.js', () => ({
  handleChannelSessionEvent: mocks.handleChannelSessionEvent
}))

vi.mock('#~/services/config/index.js', () => ({
  loadMergedConfig: mocks.loadMergedConfig
}))

vi.mock('#~/services/session/notification.js', () => ({
  maybeNotifySession: vi.fn().mockResolvedValue(undefined)
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
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('startAdapterSession', () => {
  let currentSession: any
  const getMessages = vi.fn()
  const saveMessage = vi.fn()
  const createSession = vi.fn()
  const updateSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    adapterSessionStore.clear()
    externalSessionStore.clear()

    currentSession = {
      id: 'sess-1',
      createdAt: Date.now(),
      status: 'completed',
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    }

    getMessages.mockReturnValue([])
    createSession.mockImplementation((_title?: string, id?: string) => ({
      id: id ?? 'sess-1',
      createdAt: Date.now()
    }))
    updateSession.mockImplementation((_id: string, updates: Record<string, unknown>) => {
      currentSession = { ...currentSession, ...updates }
    })

    vi.mocked(getDb).mockReturnValue({
      getMessages,
      saveMessage,
      getSession: vi.fn(() => currentSession),
      createSession,
      updateSession
    } as any)

    mocks.generateAdapterQueryOptions.mockResolvedValue([
      {},
      {
        systemPrompt: undefined,
        tools: undefined,
        mcpServers: undefined
      }
    ])
    mocks.loadMergedConfig.mockResolvedValue({ mergedConfig: {} })
    mocks.handleChannelSessionEvent.mockResolvedValue(undefined)
  })

  it('reuses the cached runtime when adapter config is unchanged', async () => {
    const runtime = {
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      } as any,
      sockets: new Set(),
      messages: [],
      config: {
        runId: 'run-same',
        model: 'gpt-4o',
        adapter: 'codex',
        permissionMode: 'default'
      }
    }
    adapterSessionStore.set('sess-1', runtime as any)

    const result = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(result).toBe(runtime)
    expect(mocks.run).not.toHaveBeenCalled()
    expect(runtime.session.kill).not.toHaveBeenCalled()
  })

  it('restarts the runtime when adapter changes and ignores stale exit events', async () => {
    const oldKill = vi.fn()
    const oldEmit = vi.fn()
    const newKill = vi.fn()
    const newEmit = vi.fn()
    let oldOnEvent: ((event: any) => void) | undefined

    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      expect(adapterOptions.type).toBe('resume')
      oldOnEvent = adapterOptions.onEvent
      return {
        session: {
          kill: oldKill,
          emit: oldEmit
        }
      }
    })

    const initialRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(initialRuntime.config?.adapter).toBe('codex')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      expect(adapterOptions.type).toBe('create')
      return {
        session: {
          kill: newKill,
          emit: newEmit
        }
      }
    })

    const restartedRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    expect(oldKill).toHaveBeenCalledOnce()
    expect(restartedRuntime).not.toBe(initialRuntime)
    expect(restartedRuntime.config?.adapter).toBe('claude-code')
    expect(currentSession.adapter).toBe('claude-code')

    oldOnEvent?.({
      type: 'exit',
      data: {
        exitCode: 1,
        stderr: 'old runtime exit'
      }
    })

    expect(currentSession.status).toBe('completed')
    expect(adapterSessionStore.get('sess-1')).toBe(restartedRuntime)
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        adapter: 'claude-code'
      })
    )
    expect(newKill).not.toHaveBeenCalled()
  })

  it('marks the session as failed when adapter startup throws', async () => {
    mocks.run.mockRejectedValueOnce(new Error('adapter init failed'))

    await expect(startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })).rejects.toThrow('adapter init failed')

    expect(currentSession.status).toBe('failed')
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        status: 'failed'
      })
    )
  })

  it('replaces the generated system prompt when appendSystemPrompt is false', async () => {
    mocks.generateAdapterQueryOptions.mockResolvedValueOnce([
      {},
      {
        systemPrompt: 'generated prompt',
        tools: undefined,
        mcpServers: undefined
      }
    ])
    mocks.run.mockResolvedValueOnce({
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })

    await startAdapterSession('sess-1', {
      systemPrompt: 'custom prompt',
      appendSystemPrompt: false
    })

    expect(mocks.run).toHaveBeenCalledOnce()
    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      systemPrompt: 'custom prompt',
      appendSystemPrompt: false
    }))
  })

  it('keeps the session failed when a fatal error is followed by stop', async () => {
    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      adapterOptions.onEvent({
        type: 'error',
        data: {
          message: 'turn failed',
          fatal: true
        }
      })
      adapterOptions.onEvent({
        type: 'stop',
        data: undefined
      })
      return {
        session: {
          emit: vi.fn(),
          kill: vi.fn()
        }
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(currentSession.status).toBe('failed')
  })

  it('restarts the adapter on demand when a follow-up user message arrives after completion', async () => {
    const emit = vi.fn()

    currentSession.status = 'completed'
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    await processUserMessage('sess-1', 'follow up')

    expect(mocks.run).toHaveBeenCalledOnce()
    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      type: 'resume',
      sessionId: 'sess-1'
    }))
    expect(emit).toHaveBeenCalledWith({
      type: 'message',
      content: [{ type: 'text', text: 'follow up' }],
      parentUuid: 'assist-1'
    })
    expect(currentSession.status).toBe('running')
    expect(saveMessage).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({
          role: 'user',
          content: 'follow up'
        })
      })
    )
  })

  it('promotes passive session sockets when a follow-up user message restarts the adapter', async () => {
    const emit = vi.fn()
    const passiveSocket = {
      readyState: 1,
      send: vi.fn()
    }

    currentSession.status = 'completed'
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])
    externalSessionStore.set('sess-1', {
      sockets: new Set([passiveSocket as any]),
      messages: []
    })
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    await processUserMessage('sess-1', 'follow up')

    expect(externalSessionStore.has('sess-1')).toBe(false)
    expect(adapterSessionStore.get('sess-1')?.sockets.has(passiveSocket as any)).toBe(true)
    expect(passiveSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"message"'))
    expect(emit).toHaveBeenCalledWith({
      type: 'message',
      content: [{ type: 'text', text: 'follow up' }],
      parentUuid: 'assist-1'
    })
  })
})
