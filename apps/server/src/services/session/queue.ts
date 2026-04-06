import type {
  ChatMessage,
  ChatMessageContent,
  SessionMessageQueueState,
  SessionQueuedMessage,
  SessionQueuedMessageMode,
  WSEvent
} from '@vibe-forge/core'
/* eslint-disable max-lines */

import { getDb } from '#~/db/index.js'
import {
  broadcastSessionEvent,
  getSessionQueueRuntimeState,
  notifySessionUpdated
} from '#~/services/session/runtime.js'

const EMPTY_QUEUE: SessionMessageQueueState = {
  steer: [],
  next: []
}

const hasToolResultContent = (message: ChatMessage) => {
  return Array.isArray(message.content) && message.content.some(item => item.type === 'tool_result')
}

export function listSessionQueuedMessages(sessionId: string): SessionMessageQueueState {
  const items = getDb().listSessionQueuedMessages(sessionId)
  return items.reduce<SessionMessageQueueState>((acc, item) => {
    acc[item.mode].push(item)
    return acc
  }, {
    steer: [],
    next: []
  })
}

export function broadcastSessionQueueUpdated(sessionId: string) {
  const queue = listSessionQueuedMessages(sessionId)
  const event: WSEvent = {
    type: 'session_queue_updated',
    queue
  }
  broadcastSessionEvent(sessionId, event)
  return queue
}

export function createSessionQueuedMessage(
  sessionId: string,
  mode: SessionQueuedMessageMode,
  content: ChatMessageContent[]
) {
  const created = getDb().createSessionQueuedMessage(sessionId, mode, content)
  if (mode === 'next') {
    armNextQueueInterrupt(sessionId)
  }
  broadcastSessionQueueUpdated(sessionId)
  return created
}

export function updateSessionQueuedMessage(sessionId: string, id: string, content: ChatMessageContent[]) {
  const updated = getDb().updateSessionQueuedMessage(sessionId, id, content)
  if (updated == null) {
    return undefined
  }
  broadcastSessionQueueUpdated(sessionId)
  return updated
}

export function moveSessionQueuedMessage(sessionId: string, id: string, mode: SessionQueuedMessageMode) {
  const moved = getDb().moveSessionQueuedMessage(sessionId, id, mode)
  if (moved == null) {
    return undefined
  }

  const queue = listSessionQueuedMessages(sessionId)
  if (queue.next.length === 0) {
    clearNextQueueInterrupt(sessionId)
  } else if (mode === 'next') {
    armNextQueueInterrupt(sessionId)
  }

  broadcastSessionQueueUpdated(sessionId)
  return moved
}

export function deleteSessionQueuedMessage(sessionId: string, id: string) {
  const removed = getDb().deleteSessionQueuedMessage(sessionId, id)
  if (!removed) {
    return false
  }

  const queue = listSessionQueuedMessages(sessionId)
  if (queue.next.length === 0) {
    clearNextQueueInterrupt(sessionId)
  }
  broadcastSessionQueueUpdated(sessionId)
  return true
}

export function reorderSessionQueuedMessages(sessionId: string, mode: SessionQueuedMessageMode, ids: string[]) {
  getDb().reorderSessionQueuedMessages(sessionId, mode, ids)
  broadcastSessionQueueUpdated(sessionId)
  return listSessionQueuedMessages(sessionId)[mode]
}

export function armNextQueueInterrupt(sessionId: string) {
  const runtime = getSessionQueueRuntimeState(sessionId)
  const session = getDb().getSession(sessionId)
  if (runtime == null || session?.status !== 'running') {
    return false
  }
  runtime.nextInterruptRequested = true
  return true
}

export function clearNextQueueInterrupt(sessionId: string) {
  const runtime = getSessionQueueRuntimeState(sessionId)
  if (runtime == null) {
    return
  }
  runtime.nextInterruptRequested = false
  runtime.nextInterruptPending = false
}

export function shouldInterruptForQueuedNext(
  sessionId: string,
  event: Extract<WSEvent, { type: 'message' }> | Extract<WSEvent, { type: 'stop' }>
) {
  const runtime = getSessionQueueRuntimeState(sessionId)
  if (runtime == null || runtime.nextInterruptRequested === false || runtime.nextInterruptPending) {
    return false
  }

  const queue = listSessionQueuedMessages(sessionId)
  if (queue.next.length === 0) {
    clearNextQueueInterrupt(sessionId)
    return false
  }

  if (event.type === 'message' && !hasToolResultContent(event.message)) {
    return false
  }

  runtime.nextInterruptRequested = false
  runtime.nextInterruptPending = true
  return true
}

export function consumeQueuedTurn(sessionId: string): {
  item?: SessionQueuedMessage
  remaining: SessionMessageQueueState
} {
  const queue = listSessionQueuedMessages(sessionId)
  const item = queue.next[0] ?? queue.steer[0]
  if (item == null) {
    clearNextQueueInterrupt(sessionId)
    return { remaining: queue }
  }

  getDb().deleteSessionQueuedMessage(sessionId, item.id)
  const remaining = listSessionQueuedMessages(sessionId)
  const runtime = getSessionQueueRuntimeState(sessionId)
  if (runtime != null) {
    runtime.nextInterruptPending = false
    runtime.nextInterruptRequested = remaining.next.length > 0
  }
  broadcastSessionQueueUpdated(sessionId)

  return { item, remaining }
}

export function maybeDispatchQueuedTurn(
  sessionId: string,
  dispatch: (content: ChatMessageContent[]) => Promise<void> | void
) {
  const session = getDb().getSession(sessionId)
  if (session == null) {
    return false
  }

  if (session.status === 'running' || session.status === 'waiting_input') {
    return false
  }

  const { item, remaining } = consumeQueuedTurn(sessionId)
  if (item == null) {
    return false
  }

  void Promise.resolve(dispatch(item.content))
    .then(() => {
      if (remaining.next.length > 0) {
        armNextQueueInterrupt(sessionId)
      }
    })
    .catch(() => {
      const runtime = getSessionQueueRuntimeState(sessionId)
      if (runtime != null) {
        runtime.nextInterruptPending = false
      }
      const updatedSession = getDb().getSession(sessionId)
      if (updatedSession != null) {
        notifySessionUpdated(sessionId, updatedSession)
      }
    })

  return true
}

export function getEmptySessionQueueState() {
  return EMPTY_QUEUE
}
