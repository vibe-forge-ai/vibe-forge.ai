import type { ConfigSource, WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { extractTextFromMessage } from '#~/services/session/events.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'

import { pipeline } from './middleware'
import type { ChannelContext, ChannelTextMessage } from './middleware/@types'
import { defineMessages } from './middleware/i18n'
import { consumePendingUnack, deleteBinding, resolveBinding } from './state'
import type { ChannelRuntimeState } from './types'

export const handleInboundEvent = async (
  channelKey: string,
  inbound: ChannelInboundEvent,
  connection: ChannelConnection<ChannelTextMessage> | undefined,
  config?: ChannelBaseConfig,
  configSource?: ConfigSource
) => {
  const ctx: ChannelContext = {
    channelKey,
    configSource,
    inbound,
    connection,
    config,
    sessionId: undefined,
    contentItems: undefined,
    commandText: '',
    defineMessages,
    t: (key) => key,
    reply: async (text: string) => {
      if (!connection) return undefined
      const receiveId = inbound.replyTo?.receiveId ?? inbound.channelId
      const receiveIdType = inbound.replyTo?.receiveIdType ?? 'chat_id'
      return connection.sendMessage({ receiveId, receiveIdType, text })
    },
    pushFollowUps: async ({ messageId, followUps }) => {
      if (!connection?.pushFollowUps || !messageId || followUps.length === 0) return
      await connection.pushFollowUps({ messageId, followUps })
    },
    getBoundSession: () => {
      if (!ctx.sessionId) return undefined
      return getDb().getSession(ctx.sessionId)
    },
    resetSession: () => {
      const { sessionId } = ctx
      if (sessionId) {
        getDb().deleteChannelSessionBySessionId(sessionId)
        deleteBinding(sessionId)
        ctx.sessionId = undefined
      }
    },
    stopSession: () => {
      if (ctx.sessionId) {
        killSession(ctx.sessionId)
      }
    },
    restartSession: async () => {
      if (ctx.sessionId) {
        killSession(ctx.sessionId)
        await startAdapterSession(ctx.sessionId)
      }
    },
    updateSession: (updates) => {
      if (ctx.sessionId) {
        getDb().updateSession(ctx.sessionId, updates)
      }
    }
  }

  await pipeline(ctx)
}

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
