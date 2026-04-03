import type { ConfigSource, WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { extractTextFromMessage } from '#~/services/session/events.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import { getSessionLogger } from '#~/utils/logger.js'

import { buildInteractionText } from './interaction'
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
  const binding = resolveBinding(sessionId)
  if (!binding) return false
  const state = states.get(binding.channelKey)
  if (!state?.connection) return false
  const receiveId = binding.replyReceiveId ?? binding.channelId
  const receiveIdType = binding.replyReceiveIdType ?? 'chat_id'
  const serverLogger = getSessionLogger(sessionId, 'server')

  if (event.type === 'interaction_request') {
    const unack = consumePendingUnack(sessionId)
    if (unack) {
      await unack().catch(() => undefined)
    }

    const language = state.config?.language ?? 'zh'
    const options = event.payload.options ?? []
    const hasDescriptions = options.some(option => (option.description?.trim() ?? '') !== '')
    const text = buildInteractionText(language, event.payload)
    const result = await state.connection.sendMessage({ receiveId, receiveIdType, text })
    let followUpsPushed = false

    if (
      !event.payload.multiselect &&
      options.length > 0 &&
      result?.messageId != null &&
      state.connection.pushFollowUps
    ) {
      try {
        await state.connection.pushFollowUps({
          messageId: result.messageId,
          followUps: options.map(option => ({ content: option.label }))
        })
        followUpsPushed = true
      } catch (error) {
        serverLogger.warn({
          sessionId,
          interactionId: event.id,
          receiveId,
          messageId: result.messageId,
          error: error instanceof Error ? error.message : String(error)
        }, '[channel] Failed to push follow-up actions for interaction request')
      }
    }

    serverLogger.info({
      sessionId,
      interactionId: event.id,
      receiveId,
      optionCount: options.length,
      hasDescriptions,
      pushedFollowUps: followUpsPushed
    }, '[channel] Delivered interaction request to bound channel')
    return true
  }

  if (event.type !== 'message' || event.message.role !== 'assistant') return false
  const text = extractTextFromMessage(event.message)
  if (text == null || text === '') return false

  const unack = consumePendingUnack(sessionId)
  if (unack) {
    await unack().catch(() => undefined)
  }

  await state.connection.sendMessage({ receiveId, receiveIdType, text })
  return true
}
