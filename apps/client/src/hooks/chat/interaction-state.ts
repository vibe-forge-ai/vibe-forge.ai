import type { AskUserQuestionParams, Session, WSEvent } from '@vibe-forge/core'

import { stripAnsi } from '#~/utils/strip-ansi'

export interface InteractionRequestState {
  id: string
  payload: AskUserQuestionParams
}

export interface ChatErrorState {
  kind: 'connection' | 'session'
  message: string
  code?: string
  reason?: 'error' | 'closed'
}

export interface FatalSessionErrorState {
  message: string
  code?: string
}

const normalizeErrorMessage = (value: string) => stripAnsi(value).trim()

export const getFatalSessionError = (event: WSEvent): FatalSessionErrorState | null => {
  if (event?.type !== 'error') {
    return null
  }

  if (event.data != null && typeof event.data === 'object' && 'fatal' in event.data && event.data.fatal === false) {
    return null
  }

  const code = event.data != null && typeof event.data === 'object' &&
      'code' in event.data &&
      typeof event.data.code === 'string' &&
      event.data.code.trim() !== ''
    ? event.data.code
    : undefined

  if (event.data != null && typeof event.data === 'object' && 'message' in event.data) {
    const message = event.data.message
    if (typeof message === 'string') {
      const normalizedMessage = normalizeErrorMessage(message)
      if (normalizedMessage !== '') {
        return {
          message: normalizedMessage,
          code
        }
      }
    }
  }

  if (typeof event.message === 'string') {
    const normalizedMessage = normalizeErrorMessage(event.message)
    if (normalizedMessage !== '') {
      return {
        message: normalizedMessage,
        code
      }
    }
  }

  return null
}

export const applyInteractionStateEvent = (
  currentInteraction: InteractionRequestState | null,
  data: WSEvent
) => {
  if (data.type === 'interaction_request') {
    return { id: data.id, payload: data.payload }
  }

  if (data.type === 'interaction_response') {
    return currentInteraction?.id === data.id || currentInteraction == null
      ? null
      : currentInteraction
  }

  if (data.type === 'session_updated') {
    const session = data.session as Session | { id: string; isDeleted: boolean }
    if ('isDeleted' in session) {
      return null
    }
    if (session.status !== 'waiting_input') {
      return null
    }
  }

  if (data.type === 'error' && data.data != null && typeof data.data === 'object' && 'fatal' in data.data) {
    return (data.data as { fatal?: boolean }).fatal !== false ? null : currentInteraction
  }

  return currentInteraction
}

export const restoreInteractionStateFromHistory = (
  events: WSEvent[],
  fallbackInteraction: InteractionRequestState | null,
  sessionStatus?: Session['status']
) => {
  let currentInteraction: InteractionRequestState | null = null

  for (const event of events) {
    currentInteraction = applyInteractionStateEvent(currentInteraction, event)
  }

  if (currentInteraction != null) {
    return currentInteraction
  }

  return sessionStatus === 'waiting_input' ? fallbackInteraction : null
}

export const findLatestFatalError = (events: WSEvent[]): FatalSessionErrorState | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const resolved = getFatalSessionError(events[index]!)
    if (resolved != null) {
      return resolved
    }
  }

  return null
}
