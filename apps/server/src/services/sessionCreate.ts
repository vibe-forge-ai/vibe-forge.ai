import type { ChatMessageContent, Session } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { processUserMessage, startAdapterSession } from '#~/services/session.js'
import { notifySessionUpdated } from '#~/websocket/events.js'

export async function createSessionWithInitialMessage(options: {
  title?: string
  initialMessage?: string
  initialContent?: ChatMessageContent[]
  parentSessionId?: string
  id?: string
  shouldStart?: boolean
  tags?: string[]
  model?: string
  promptType?: 'spec' | 'entity'
  promptName?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  systemPrompt?: string
  adapter?: string
}): Promise<Session> {
  const {
    title,
    initialMessage,
    initialContent,
    parentSessionId,
    id,
    shouldStart = true,
    tags,
    model,
    promptType,
    promptName,
    permissionMode,
    systemPrompt,
    adapter
  } = options
  const db = getDb()
  const session = db.createSession(title, id, undefined, parentSessionId)
  if (model !== undefined || permissionMode !== undefined || adapter !== undefined) {
    db.updateSession(session.id, { model, permissionMode, adapter })
    const updatedSession = db.getSession(session.id)
    if (updatedSession) {
      Object.assign(session, updatedSession)
    }
  }
  notifySessionUpdated(session.id, session)

  if (tags && tags.length > 0) {
    db.updateSessionTags(session.id, tags)
    const updated = db.getSession(session.id)
    if (updated) {
      Object.assign(session, updated)
      notifySessionUpdated(session.id, updated)
    }
  }

  if ((initialMessage || initialContent) && shouldStart) {
    try {
      await startAdapterSession(session.id, { model, promptType, promptName, permissionMode, systemPrompt, adapter })
      if (initialContent) {
        processUserMessage(session.id, initialContent)
      } else if (initialMessage) {
        processUserMessage(session.id, initialMessage)
      }

      const updated = db.getSession(session.id)
      if (updated) {
        Object.assign(session, updated)
      }
    } catch (err) {
      console.error(`[sessions] Failed to start session ${session.id}:`, err)
    }
  }

  return session
}
