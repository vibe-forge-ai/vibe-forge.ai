import { v4 as uuidv4 } from 'uuid'

import type { AskUserQuestionParams, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { updateAndNotifySession } from '#~/services/session/index.js'
import {
  broadcastSessionEvent,
  deletePendingSessionInteraction,
  emitRuntimeEvent,
  getPendingSessionInteraction,
  getSessionConnectionState,
  notifySessionUpdated,
  setPendingSessionInteraction
} from '#~/services/session/runtime.js'

export function getSessionInteraction(sessionId: string) {
  return getSessionConnectionState(sessionId)?.currentInteraction
}

export function setSessionInteraction(sessionId: string, interaction: { id: string; payload: AskUserQuestionParams }) {
  const runtime = getSessionConnectionState(sessionId)
  if (runtime != null) {
    runtime.currentInteraction = interaction
  }
}

export function clearSessionInteraction(sessionId: string, interactionId: string) {
  const runtime = getSessionConnectionState(sessionId)
  if (runtime?.currentInteraction?.id === interactionId) {
    runtime.currentInteraction = undefined
  }
}

export function requestInteraction(params: AskUserQuestionParams): Promise<string | string[]> {
  const { sessionId } = params
  const runtime = getSessionConnectionState(sessionId)

  if (runtime == null || runtime.sockets.size === 0) {
    return Promise.reject(new Error(`Session ${sessionId} is not active`))
  }

  const interactionId = uuidv4()
  const event: WSEvent = {
    type: 'interaction_request',
    id: interactionId,
    payload: params
  }

  runtime.currentInteraction = { id: interactionId, payload: params }
  emitRuntimeEvent(runtime, event, { recordMessage: false })

  updateAndNotifySession(sessionId, { status: 'waiting_input' })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      deletePendingSessionInteraction(interactionId)
      if (runtime.currentInteraction?.id === interactionId) {
        runtime.currentInteraction = undefined
      }
      reject(new Error('Interaction timed out'))
    }, 5 * 60 * 1000)

    setPendingSessionInteraction(interactionId, { resolve, reject, timer })
  })
}

export function handleInteractionResponse(sessionId: string, interactionId: string, data: unknown) {
  const sessionData = getDb().getSession(sessionId)
  const isExternalSession = sessionData?.parentSessionId != null

  if (isExternalSession) {
    clearSessionInteraction(sessionId, interactionId)
    const event: WSEvent = { type: 'interaction_response', id: interactionId, data: data as string | string[] }
    applySessionEvent(sessionId, event, {
      broadcast: (nextEvent) => broadcastSessionEvent(sessionId, nextEvent),
      onSessionUpdated: (session) => {
        notifySessionUpdated(sessionId, session)
      }
    })
    return
  }

  const pending = getPendingSessionInteraction(interactionId)
  if (pending == null) {
    return
  }

  clearTimeout(pending.timer)
  clearSessionInteraction(sessionId, interactionId)
  updateAndNotifySession(sessionId, { status: 'running' })
  pending.resolve(data as string | string[])
  deletePendingSessionInteraction(interactionId)
}
