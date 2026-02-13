import type { Session } from '@vibe-forge/core'

import { getDb } from '#~/db.js'
import {
  notifySessionUpdated,
  processUserMessage,
  startAdapterSession
} from '#~/websocket/index.js'

export async function createSessionWithInitialMessage(options: {
  title?: string
  initialMessage?: string
  parentSessionId?: string
  id?: string
  shouldStart?: boolean
  tags?: string[]
}): Promise<Session> {
  const {
    title,
    initialMessage,
    parentSessionId,
    id,
    shouldStart = true,
    tags
  } = options
  const db = getDb()
  const session = db.createSession(title, id, undefined, parentSessionId)
  notifySessionUpdated(session.id, session)

  if (tags && tags.length > 0) {
    db.updateSessionTags(session.id, tags)
    const updated = db.getSession(session.id)
    if (updated) {
      Object.assign(session, updated)
      notifySessionUpdated(session.id, updated)
    }
  }

  if (initialMessage && shouldStart) {
    try {
      await startAdapterSession(session.id)
      processUserMessage(session.id, initialMessage)

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
