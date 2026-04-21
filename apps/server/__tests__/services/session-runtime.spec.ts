import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  adapterSessionStore,
  createSessionConnectionState,
  externalSessionStore,
  notifyConfigUpdated,
  notifySessionUpdated,
  sessionSubscriberSockets,
  takeExternalSessionRuntime
} from '#~/services/session/runtime.js'

describe('notifySessionUpdated', () => {
  beforeEach(() => {
    adapterSessionStore.clear()
    externalSessionStore.clear()
    sessionSubscriberSockets.clear()
  })

  it('broadcasts session updates to the active session socket and global subscribers', () => {
    const sessionSocket = {
      readyState: 1,
      send: vi.fn()
    }
    const subscriberSocket = {
      readyState: 1,
      send: vi.fn()
    }

    const runtime = createSessionConnectionState()
    runtime.sockets.add(sessionSocket as any)
    adapterSessionStore.set('sess-1', {
      ...runtime,
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    } as any)
    sessionSubscriberSockets.add(subscriberSocket as any)

    notifySessionUpdated('sess-1', {
      id: 'sess-1',
      createdAt: Date.now(),
      status: 'completed'
    } as any)

    expect(sessionSocket.send).toHaveBeenCalledOnce()
    expect(subscriberSocket.send).toHaveBeenCalledOnce()
    expect(String(sessionSocket.send.mock.calls[0]?.[0])).toContain('"type":"session_updated"')
  })

  it('broadcasts config updates to global subscribers', () => {
    const subscriberSocket = {
      readyState: 1,
      send: vi.fn()
    }

    sessionSubscriberSockets.add(subscriberSocket as any)

    notifyConfigUpdated('/workspace/demo')

    expect(subscriberSocket.send).toHaveBeenCalledOnce()
    expect(String(subscriberSocket.send.mock.calls[0]?.[0])).toContain('"type":"config_updated"')
    expect(String(subscriberSocket.send.mock.calls[0]?.[0])).toContain('"/workspace/demo"')
  })

  it('can promote a passive runtime into an adapter runtime', () => {
    const passiveRuntime = createSessionConnectionState()
    externalSessionStore.set('sess-1', passiveRuntime)

    const taken = takeExternalSessionRuntime('sess-1')

    expect(taken).toBe(passiveRuntime)
    expect(externalSessionStore.has('sess-1')).toBe(false)
  })
})
