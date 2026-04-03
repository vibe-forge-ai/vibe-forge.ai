import type { AskUserQuestionParams, Session, WSEvent } from '@vibe-forge/core'

export interface InteractionRequestState {
  id: string
  payload: AskUserQuestionParams
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
