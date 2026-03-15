import type { WSEvent } from '@vibe-forge/core'

import { extractTextFromMessage } from '#~/services/sessionEvents.js'

import { consumePendingUnack, resolveBinding } from './state'
import type { ChannelRuntimeState } from './types'

export { handleInboundEvent } from './middleware'

export const handleSessionEvent = async (
  states: Map<string, ChannelRuntimeState>,
  sessionId: string,
  event: WSEvent
) => {
  if (event.type !== 'message' || event.message.role !== 'assistant') return
  const text = extractTextFromMessage(event.message)
  if (text == null || text === '') return

  const unack = consumePendingUnack(sessionId)
  if (unack) {
    await unack().catch(() => undefined)
  }

  const binding = resolveBinding(sessionId)
  if (!binding) return
  const state = states.get(binding.channelKey)
  if (!state?.connection) return
  const receiveId = binding.replyReceiveId ?? binding.channelId
  const receiveIdType = binding.replyReceiveIdType ?? 'chat_id'
  await state.connection.sendMessage({ receiveId, receiveIdType, text })
}
