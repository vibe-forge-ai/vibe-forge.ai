import type { ChatMessage, ChatMessageContent, Session, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { buildSessionToolViews, collectAffectedToolUseIdsFromEvent } from '#~/services/session/tool-view.js'

export interface SessionEventCallbacks {
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
    const fileContent = message.content.find((c): c is Extract<ChatMessageContent, { type: 'file' }> =>
      c.type === 'file'
    )
    if (fileContent != null) {
      return `Context file: ${fileContent.path}`
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
    if (event.data.fatal !== false) {
      updates.status = 'failed'
    }
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

    if (event.type === 'message') {
      const affectedToolUseIds = collectAffectedToolUseIdsFromEvent(event)
      if (affectedToolUseIds.size > 0) {
        const session = db.getSession(sessionId)
        const toolViews = buildSessionToolViews(
          db.getMessages<WSEvent>(sessionId),
          { adapterInstanceId: session?.adapter }
        )

        for (const toolView of Object.values(toolViews)) {
          if (affectedToolUseIds.has(toolView.toolUseId)) {
            callbacks.broadcast({
              type: 'tool_view',
              view: toolView
            })
          }
        }
      }
    }
  }
}
