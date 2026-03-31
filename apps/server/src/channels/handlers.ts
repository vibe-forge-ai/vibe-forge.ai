import type { ConfigSource, WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { extractTextFromMessage } from '#~/services/session/events.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'

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
    channelAdapter: undefined,
    channelPermissionMode: undefined,
    channelEffort: undefined,
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
        const updatedIds = getDb().updateSessionArchivedWithChildren(sessionId, true)
        for (const updatedId of updatedIds) {
          const updatedSession = getDb().getSession(updatedId)
          if (updatedSession != null) {
            notifySessionUpdated(updatedId, updatedSession)
          }
        }
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
    },
    getChannelAdapterPreference: () => ctx.channelAdapter,
    setChannelAdapterPreference: (adapter) => {
      ctx.channelAdapter = adapter
      getDb().upsertChannelPreference({
        channelType: inbound.channelType,
        sessionType: inbound.sessionType,
        channelId: inbound.channelId,
        channelKey,
        adapter,
        permissionMode: ctx.channelPermissionMode,
        effort: ctx.channelEffort
      })
    },
    getChannelPermissionModePreference: () => ctx.channelPermissionMode,
    setChannelPermissionModePreference: (permissionMode) => {
      ctx.channelPermissionMode = permissionMode
      getDb().upsertChannelPreference({
        channelType: inbound.channelType,
        sessionType: inbound.sessionType,
        channelId: inbound.channelId,
        channelKey,
        adapter: ctx.channelAdapter,
        permissionMode,
        effort: ctx.channelEffort
      })
    },
    getChannelEffortPreference: () => ctx.channelEffort,
    setChannelEffortPreference: (effort) => {
      ctx.channelEffort = effort
      getDb().upsertChannelPreference({
        channelType: inbound.channelType,
        sessionType: inbound.sessionType,
        channelId: inbound.channelId,
        channelKey,
        adapter: ctx.channelAdapter,
        permissionMode: ctx.channelPermissionMode,
        effort
      })
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
