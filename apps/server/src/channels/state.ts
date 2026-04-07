import { getDb } from '#~/db/index.js'

import type { ChannelToolCallSummary } from './middleware/@types/index.js'
import type { ChannelSessionBinding } from './types'

interface PendingToolCallDisplay {
  summary: ChannelToolCallSummary
  messageId?: string
}

const sessionBindings = new Map<string, ChannelSessionBinding>()
const pendingSessionUnack = new Map<string, (() => Promise<void>) | undefined>()
const pendingToolCallDisplays = new Map<string, PendingToolCallDisplay>()
const pendingToolCallDisplayUpdates = new Map<string, Promise<void>>()
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
  pendingToolCallDisplays.delete(sessionId)
  pendingToolCallDisplayUpdates.delete(sessionId)
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

export const resolvePendingToolCallDisplay = (sessionId: string) => pendingToolCallDisplays.get(sessionId)

export const setPendingToolCallDisplay = (
  sessionId: string,
  display: PendingToolCallDisplay
) => {
  pendingToolCallDisplays.set(sessionId, display)
}

export const clearPendingToolCallDisplay = (sessionId: string) => {
  const display = pendingToolCallDisplays.get(sessionId)
  if (display != null) {
    pendingToolCallDisplays.delete(sessionId)
  }
  return display
}

export const runPendingToolCallDisplayUpdate = async <T>(
  sessionId: string,
  task: () => Promise<T>
) => {
  const previous = pendingToolCallDisplayUpdates.get(sessionId) ?? Promise.resolve()
  const currentTask = previous
    .catch(() => undefined)
    .then(task)
  const marker = currentTask.then(
    () => undefined,
    () => undefined
  )
  pendingToolCallDisplayUpdates.set(sessionId, marker)

  try {
    return await currentTask
  } finally {
    if (pendingToolCallDisplayUpdates.get(sessionId) === marker) {
      pendingToolCallDisplayUpdates.delete(sessionId)
    }
  }
}

export const isDuplicateMessage = (key: string) => {
  if (seenMessageIds.has(key)) return true
  seenMessageIds.set(key, Date.now())
  if (seenMessageIds.size > maxSeenMessageIds) {
    seenMessageIds.clear()
  }
  return false
}
