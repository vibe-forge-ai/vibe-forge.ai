import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  adapterSessionStore,
  createSessionConnectionState,
  notifySessionUpdated,
  sessionSubscriberSockets
} from '#~/services/session/runtime.js'

describe('notifySessionUpdated', () => {
  beforeEach(() => {
    adapterSessionStore.clear()
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
})
