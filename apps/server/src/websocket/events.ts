import type { Session, WSEvent } from '@vibe-forge/core'

import { adapterCache, externalCache, globalSockets } from './cache'
import { sendToClient } from './utils'

export function broadcastSessionEvent(sessionId: string, event: WSEvent) {
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.messages.push(event)
    for (const socket of cached.sockets) {
      sendToClient(socket, event)
    }
  }
  const externalCached = externalCache.get(sessionId)
  if (externalCached != null) {
    externalCached.messages.push(event)
    for (const socket of externalCached.sockets) {
      sendToClient(socket, event)
    }
  }
}

export function notifySessionUpdated(sessionId: string, session: Session | { id: string; isDeleted: boolean }) {
  const event: WSEvent = { type: 'session_updated', session }
  for (const socket of globalSockets) {
    sendToClient(socket, event)
  }
}
