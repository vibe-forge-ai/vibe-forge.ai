import { v4 as uuidv4 } from 'uuid'
import type { WebSocket } from 'ws'

import type { AskUserQuestionParams, WSEvent } from '@vibe-forge/core'

import { adapterCache, externalCache, pendingInteractions } from './cache'
import { updateAndNotifySession } from './session'
import { sendToClient } from './utils'

export function getSessionInteraction(sessionId: string) {
  const cached = adapterCache.get(sessionId)
  if (cached?.currentInteraction != null) {
    return cached.currentInteraction
  }
  return externalCache.get(sessionId)?.currentInteraction
}

export function setSessionInteraction(sessionId: string, interaction: { id: string; payload: AskUserQuestionParams }) {
  const cached = adapterCache.get(sessionId)
  if (cached != null) {
    cached.currentInteraction = interaction
    return
  }
  const externalCached = externalCache.get(sessionId) ?? { sockets: new Set<WebSocket>(), messages: [] }
  externalCached.currentInteraction = interaction
  externalCache.set(sessionId, externalCached)
}

export function clearSessionInteraction(sessionId: string, interactionId: string) {
  const cached = adapterCache.get(sessionId)
  if (cached?.currentInteraction?.id === interactionId) {
    cached.currentInteraction = undefined
    return
  }
  const externalCached = externalCache.get(sessionId)
  if (externalCached?.currentInteraction?.id === interactionId) {
    externalCached.currentInteraction = undefined
  }
}

export function requestInteraction(params: AskUserQuestionParams): Promise<string | string[]> {
  const { sessionId } = params
  const cached = adapterCache.get(sessionId) ?? externalCache.get(sessionId)

  if (cached == null || cached.sockets.size === 0) {
    return Promise.reject(new Error(`Session ${sessionId} is not active`))
  }

  const interactionId = uuidv4()
  const event: WSEvent = {
    type: 'interaction_request',
    id: interactionId,
    payload: params
  }

  cached.currentInteraction = { id: interactionId, payload: params }

  for (const socket of cached.sockets) {
    sendToClient(socket, event)
  }

  updateAndNotifySession(sessionId, { status: 'waiting_input' })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingInteractions.delete(interactionId)
      if (cached.currentInteraction?.id === interactionId) {
        cached.currentInteraction = undefined
      }
      reject(new Error('Interaction timed out'))
    }, 5 * 60 * 1000)

    pendingInteractions.set(interactionId, { resolve, reject, timer })
  })
}
