import { v4 as uuidv4 } from 'uuid'

import type { AskUserQuestionParams, WSEvent } from '@vibe-forge/core'

import { handleChannelSessionEvent } from '#~/channels/index.js'
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
import { getSessionLogger } from '#~/utils/logger.js'

const canDeliverInteraction = (sessionId: string) => {
  const runtime = getSessionConnectionState(sessionId)
  if (runtime == null) {
    return {
      runtime,
      hasActiveWebSocket: false,
      hasChannelBinding: false,
      deliverable: false
    }
  }

  const hasActiveWebSocket = runtime.sockets.size > 0
  const hasChannelBinding = getDb().getChannelSessionBySessionId(sessionId) != null

  return {
    runtime,
    hasActiveWebSocket,
    hasChannelBinding,
    deliverable: hasActiveWebSocket || hasChannelBinding
  }
}

export const canRequestInteraction = (sessionId: string) => canDeliverInteraction(sessionId).deliverable

export function getSessionInteraction(sessionId: string) {
  const current = getSessionConnectionState(sessionId)?.currentInteraction
  if (current != null) {
    return current
  }

  const messages = getDb().getMessages(sessionId) as WSEvent[]
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const event = messages[index]
    if (event == null) continue

    if (event.type === 'interaction_response') {
      return undefined
    }

    if (event.type === 'interaction_request') {
      return {
        id: event.id,
        payload: event.payload
      }
    }
  }

  return undefined
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

export async function requestInteraction(params: AskUserQuestionParams): Promise<string | string[]> {
  const { sessionId } = params
  const delivery = canDeliverInteraction(sessionId)
  const runtime = delivery.runtime
  const serverLogger = getSessionLogger(sessionId, 'server')

  if (runtime == null || !delivery.deliverable) {
    serverLogger.warn({
      sessionId,
      hasRuntime: runtime != null,
      hasActiveWebSocket: delivery.hasActiveWebSocket,
      hasChannelBinding: delivery.hasChannelBinding
    }, '[interaction] Interaction request rejected because no delivery path is active')
    return Promise.reject(new Error(`Session ${sessionId} is not active`))
  }

  const interactionId = uuidv4()
  const event: WSEvent = {
    type: 'interaction_request',
    id: interactionId,
    payload: params
  }

  runtime.currentInteraction = { id: interactionId, payload: params }
  serverLogger.info({
    sessionId,
    interactionId,
    question: params.question,
    optionCount: params.options?.length ?? 0,
    multiselect: params.multiselect ?? false,
    hasActiveWebSocket: delivery.hasActiveWebSocket,
    hasChannelBinding: delivery.hasChannelBinding
  }, '[interaction] Queued interaction request')
  emitRuntimeEvent(runtime, event, { recordMessage: false })

  let deliveredToChannel = false
  if (delivery.hasChannelBinding) {
    try {
      deliveredToChannel = await handleChannelSessionEvent(sessionId, event)
    } catch (error) {
      serverLogger.warn({
        sessionId,
        interactionId,
        error: error instanceof Error ? error.message : String(error)
      }, '[interaction] Channel delivery failed for interaction request')
    }
  }

  if (!delivery.hasActiveWebSocket && !deliveredToChannel) {
    runtime.currentInteraction = undefined
    serverLogger.warn({
      sessionId,
      interactionId,
      hasActiveWebSocket: delivery.hasActiveWebSocket,
      hasChannelBinding: delivery.hasChannelBinding
    }, '[interaction] Interaction request rejected because no delivery path is active')
    return Promise.reject(new Error(`Session ${sessionId} is not active`))
  }

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
  const serverLogger = getSessionLogger(sessionId, 'server')
  const sessionData = getDb().getSession(sessionId)
  const isExternalSession = sessionData?.parentSessionId != null

  if (isExternalSession) {
    serverLogger.info({
      sessionId,
      interactionId,
      response: data
    }, '[interaction] Handling external interaction response')
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
    serverLogger.warn({
      sessionId,
      interactionId
    }, '[interaction] Interaction response arrived without a pending waiter')
    return
  }

  clearTimeout(pending.timer)
  clearSessionInteraction(sessionId, interactionId)
  updateAndNotifySession(sessionId, { status: 'running' })
  serverLogger.info({
    sessionId,
    interactionId,
    response: data
  }, '[interaction] Resolved interaction response')
  pending.resolve(data as string | string[])
  deletePendingSessionInteraction(interactionId)
}
