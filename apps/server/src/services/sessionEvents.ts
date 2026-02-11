import type { ChatMessage, ChatMessageContent, Session, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db.js'

export type SessionEventCallbacks = {
  broadcast?: (event: WSEvent) => void
  onSessionUpdated?: (session: Session) => void
}

export function extractTextFromMessage(message: ChatMessage): string | undefined {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    const textContent = message.content.find((c: ChatMessageContent) => c.type === 'text')
    if (textContent != null && 'text' in textContent) {
      return textContent.text
    }
  }
  return undefined
}

export function applySessionEvent(
  sessionId: string,
  event: WSEvent,
  callbacks: SessionEventCallbacks = {}
) {
  const db = getDb()
  if (event.type !== 'session_updated') {
    db.saveMessage(sessionId, event)
  }

  const updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>> = {}
  if (event.type === 'message') {
    const text = extractTextFromMessage(event.message)
    if (text != null && text !== '') {
      updates.lastMessage = text
      if (event.message.role === 'user') {
        updates.lastUserMessage = text
      }
    }
    updates.status = 'running'
  } else if (event.type === 'interaction_request') {
    updates.status = 'waiting_input'
  } else if (event.type === 'interaction_response') {
    updates.status = 'running'
  } else if (event.type === 'error') {
    updates.status = 'failed'
  }

  if (Object.keys(updates).length > 0) {
    db.updateSession(sessionId, updates)
    const updated = db.getSession(sessionId)
    if (updated != null && callbacks.onSessionUpdated) {
      callbacks.onSessionUpdated(updated)
    }
  }

  if (callbacks.broadcast) {
    callbacks.broadcast(event)
  }
}
