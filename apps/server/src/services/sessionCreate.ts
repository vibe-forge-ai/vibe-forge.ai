import type { Session } from '@vibe-forge/core'

import { getDb } from '#~/db.js'
import { notifySessionUpdated, processUserMessage, startAdapterSession } from '#~/websocket/index.js'

export async function createSessionWithInitialMessage(options: {
  title?: string
  initialMessage?: string
  parentSessionId?: string
  id?: string
  shouldStart?: boolean
  tags?: string[]
  model?: string
  promptType?: 'spec' | 'entity'
  promptName?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
}): Promise<Session> {
  const {
    title,
    initialMessage,
    parentSessionId,
    id,
    shouldStart = true,
    tags,
    model,
    promptType,
    promptName,
    permissionMode
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
      await startAdapterSession(session.id, { model, promptType, promptName, permissionMode })
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
