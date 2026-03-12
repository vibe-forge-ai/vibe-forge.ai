import { getDb } from '#~/db/index.js'

import type { ChannelSessionBinding } from './types'

const sessionBindings = new Map<string, ChannelSessionBinding>()
const pendingSessionUnack = new Map<string, (() => Promise<void>) | undefined>()
const seenMessageIds = new Map<string, number>()
const maxSeenMessageIds = 5000

export const resolveBinding = (sessionId: string) => {
  const cached = sessionBindings.get(sessionId)
  if (cached) return cached
  const row = getDb().getChannelSessionBySessionId(sessionId)
  if (!row) return
  const binding: ChannelSessionBinding = {
    channelType: row.channelType,
    channelKey: row.channelKey,
    channelId: row.channelId,
    sessionType: row.sessionType,
    replyReceiveId: row.replyReceiveId,
    replyReceiveIdType: row.replyReceiveIdType
  }
  sessionBindings.set(sessionId, binding)
  return binding
}

export const setBinding = (sessionId: string, binding: ChannelSessionBinding) => {
  sessionBindings.set(sessionId, binding)
}

export const deleteBinding = (sessionId: string) => {
  sessionBindings.delete(sessionId)
}

export const setPendingUnack = (sessionId: string, unack?: () => Promise<void>) => {
  pendingSessionUnack.set(sessionId, unack)
}

export const consumePendingUnack = (sessionId: string) => {
  const unack = pendingSessionUnack.get(sessionId)
  if (unack) {
    pendingSessionUnack.delete(sessionId)
  }
  return unack
}

export const isDuplicateMessage = (key: string) => {
  if (seenMessageIds.has(key)) return true
  seenMessageIds.set(key, Date.now())
  if (seenMessageIds.size > maxSeenMessageIds) {
    seenMessageIds.clear()
  }
  return false
}
