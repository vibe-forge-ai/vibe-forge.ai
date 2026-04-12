import type { ConfigSource, WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import { getDb } from '#~/db/index.js'
import { extractTextFromMessage } from '#~/services/session/events.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import { getSessionLogger } from '#~/utils/logger.js'

import { buildInteractionText } from './interaction'
import { bindChannelSession } from './middleware/bind-session'
import { pipeline } from './middleware'
import type { ChannelContext, ChannelTextMessage } from './middleware/@types'
import { defineMessages } from './middleware/i18n'
import { buildChannelActionUrl, buildToolCallDetailUrl } from './session-detail-url'
import {
  clearPendingToolCallDisplay,
  consumePendingUnack,
  deleteBinding,
  resolveBinding,
  resolvePendingToolCallDisplay,
  runPendingToolCallDisplayUpdate,
  setPendingToolCallDisplay
} from './state'
import { buildToolCallSummaryText, extractToolCallSummary, mergeToolCallSummaries } from './tool-call-summary'
import type { ChannelRuntimeState } from './types'

const normalizeSearchText = (value: string | undefined) => value?.trim().toLowerCase() ?? ''

const matchesSessionSearch = (session: ReturnType<ReturnType<typeof getDb>['getSession']>, query: string) => {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery === '') return true
  const haystack = [
    session?.id,
    session?.title,
    session?.lastMessage,
    session?.lastUserMessage,
    session?.model,
    session?.adapter,
    ...(session?.tags ?? [])
  ]
    .map(value => normalizeSearchText(value))
    .filter(Boolean)
    .join('\n')
  return haystack.includes(normalizedQuery)
}

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
    searchSessions: (query) => {
      const db = getDb()
      const sessions = db.getSessions('all')
        .filter(session => matchesSessionSearch(session, query))
      return sessions.map(session => {
        const binding = db.getChannelSessionBySessionId(session.id)
        return {
          session,
          binding: binding == null
            ? undefined
            : {
                channelType: binding.channelType,
                sessionType: binding.sessionType,
                channelId: binding.channelId,
                channelKey: binding.channelKey
              }
        }
      })
    },
    bindSession: (sessionId) => {
      const db = getDb()
      const session = db.getSession(sessionId)
      if (session == null) {
        return { alreadyBound: false }
      }
      const bindingResult = bindChannelSession({
        channelType: inbound.channelType,
        sessionType: inbound.sessionType,
        channelId: inbound.channelId,
        channelKey,
        replyReceiveId: inbound.replyTo?.receiveId,
        replyReceiveIdType: inbound.replyTo?.receiveIdType,
        sessionId
      })
      if (bindingResult.previousSessionId != null && bindingResult.previousSessionId !== sessionId) {
        deleteBinding(bindingResult.previousSessionId)
      }
      ctx.sessionId = sessionId
      return {
        alreadyBound: bindingResult.alreadyBound,
        session,
        previousSessionId: bindingResult.previousSessionId,
        transferredFrom: bindingResult.transferredFrom == null
          ? undefined
          : {
              channelType: bindingResult.transferredFrom.channelType,
              sessionType: bindingResult.transferredFrom.sessionType,
              channelId: bindingResult.transferredFrom.channelId,
              channelKey: bindingResult.transferredFrom.channelKey
            }
      }
    },
    unbindSession: () => {
      const currentBinding = getDb().getChannelSession(inbound.channelType, inbound.sessionType, inbound.channelId)
      const sessionId = currentBinding?.sessionId ?? ctx.sessionId
      getDb().deleteChannelSession(inbound.channelType, inbound.sessionType, inbound.channelId)
      if (sessionId) {
        deleteBinding(sessionId)
      }
      ctx.sessionId = undefined
      return { sessionId }
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
  const connection = state.connection
  const receiveId = binding.replyReceiveId ?? binding.channelId
  const receiveIdType = binding.replyReceiveIdType ?? 'chat_id'
  const serverLogger = getSessionLogger(sessionId, 'server')
  const attachToolCallDetailUrl = (
    summary: NonNullable<ReturnType<typeof extractToolCallSummary>>,
    messageId?: string
  ) => ({
    ...summary,
    items: summary.items.map(item => ({
      ...item,
      detailUrl: buildToolCallDetailUrl(state.config, {
        sessionId,
        toolUseId: item.toolUseId,
        messageId
      }),
      exportJsonUrl: buildChannelActionUrl(state.config, {
        action: 'tool-call-export',
        sessionId,
        toolUseId: item.toolUseId,
        messageId
      })
    }))
  })
  const deliverMessage = async (message: ChannelTextMessage) => {
    const unack = consumePendingUnack(sessionId)
    if (unack) {
      await unack().catch(() => undefined)
    }

    return await connection.sendMessage(message)
  }
  const upsertToolCallSummary = async (nextSummary: NonNullable<ReturnType<typeof extractToolCallSummary>>) => {
    return await runPendingToolCallDisplayUpdate(sessionId, async () => {
      const mergedSummary = mergeToolCallSummaries(
        resolvePendingToolCallDisplay(sessionId)?.summary,
        nextSummary
      )
      const message: ChannelTextMessage = {
        receiveId,
        receiveIdType,
        text: buildToolCallSummaryText(mergedSummary),
        toolCallSummary: mergedSummary
      }
      const pendingDisplay = resolvePendingToolCallDisplay(sessionId)

      if (pendingDisplay?.messageId != null && typeof connection.updateMessage === 'function') {
        const result = await connection.updateMessage(pendingDisplay.messageId, message)
        setPendingToolCallDisplay(sessionId, {
          summary: mergedSummary,
          messageId: result?.messageId ?? pendingDisplay.messageId
        })
        return true
      }

      const result = await deliverMessage(message)
      setPendingToolCallDisplay(sessionId, {
        summary: mergedSummary,
        messageId: result?.messageId ?? pendingDisplay?.messageId
      })
      return true
    })
  }

  if (event.type === 'interaction_request') {
    const language = state.config?.language ?? 'zh'
    const options = event.payload.options ?? []
    const hasDescriptions = options.some(option => (option.description?.trim() ?? '') !== '')
    const text = buildInteractionText(language, event.payload)
    const result = await deliverMessage({ receiveId, receiveIdType, text })
    let followUpsPushed = false

    if (
      !event.payload.multiselect &&
      options.length > 0 &&
      result?.messageId != null &&
      connection.pushFollowUps
    ) {
      try {
        await connection.pushFollowUps({
          messageId: result.messageId,
          followUps: options.map(option => ({ content: option.value ?? option.label }))
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

  if (event.type === 'message') {
    const toolCallSummary = extractToolCallSummary(event.message)
    if (toolCallSummary != null) {
      await upsertToolCallSummary(attachToolCallDetailUrl(toolCallSummary, event.message.id))
    }

    if (event.message.role !== 'assistant') {
      return toolCallSummary != null
    }

    const text = extractTextFromMessage(event.message)
    if (text == null || text === '') {
      return toolCallSummary != null
    }

    clearPendingToolCallDisplay(sessionId)
    await deliverMessage({ receiveId, receiveIdType, text })
    return true
  }

  return false
}
