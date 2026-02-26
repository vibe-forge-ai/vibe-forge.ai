import type { AskUserQuestionParams, Session, WSEvent } from '@vibe-forge/core'

export interface ApiOkResponse {
  ok: boolean
}

export interface ApiRemoveResponse extends ApiOkResponse {
  removed: boolean
}

export interface SessionInteraction {
  id: string
  payload: AskUserQuestionParams
}

export interface SessionMessagesResponse {
  messages: WSEvent[]
  session?: Session
  interaction?: SessionInteraction
}
