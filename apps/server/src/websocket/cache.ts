import type { AskUserQuestionParams, WSEvent } from '@vibe-forge/core'
import type { AdapterSession } from '@vibe-forge/core/adapter'
import type { WebSocket } from 'ws'

export const adapterCache = new Map<string, {
  session: AdapterSession
  sockets: Set<WebSocket>
  messages: WSEvent[]
  currentInteraction?: {
    id: string
    payload: AskUserQuestionParams
  }
}>()

export const externalCache = new Map<string, {
  sockets: Set<WebSocket>
  messages: WSEvent[]
  currentInteraction?: {
    id: string
    payload: AskUserQuestionParams
  }
}>()

export const globalSockets = new Set<WebSocket>()

export const pendingInteractions = new Map<string, {
  resolve: (data: string | string[]) => void
  reject: (reason: any) => void
  timer: NodeJS.Timeout
}>()
