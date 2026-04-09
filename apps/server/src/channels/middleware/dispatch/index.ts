import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

import { createSessionWithInitialMessage } from '#~/services/session/create.js'
import { processUserMessage } from '#~/services/session/index.js'

import type { ChannelMiddleware } from '../@types'
import { stripSpeakerPrefix } from '../@utils'
import { syncChannelSessionBinding } from '../bind-session'
import { buildSessionSystemPrompt } from './prompt'

const buildChannelTags = (inbound: ChannelInboundEvent) => {
  if (inbound.sessionType === 'direct' && inbound.senderId) {
    return [`channel:${inbound.channelType}:direct:${inbound.senderId}`]
  }
  if (inbound.sessionType === 'group') {
    return [`channel:${inbound.channelType}:group:${inbound.channelId}`]
  }
  return []
}

export const dispatchMiddleware: ChannelMiddleware = async (ctx, next) => {
  const { inbound, connection, config } = ctx
  const hasContent = ctx.contentItems != null && ctx.contentItems.length > 0

  if (!ctx.sessionId) {
    const systemPrompt = await buildSessionSystemPrompt(inbound, config, connection)
    const session = await createSessionWithInitialMessage({
      title: stripSpeakerPrefix(inbound.text ?? '').split('\n')[0],
      initialMessage: hasContent ? undefined : inbound.text,
      initialContent: hasContent ? ctx.contentItems : undefined,
      shouldStart: true,
      adapter: ctx.channelAdapter,
      effort: ctx.channelEffort,
      permissionMode: ctx.channelPermissionMode,
      tags: buildChannelTags(inbound),
      systemPrompt,
      beforeStart: async (sessionId) => {
        syncChannelSessionBinding({
          channelKey: ctx.channelKey,
          inbound,
          sessionId
        })
      }
    })
    ctx.sessionId = session.id
  } else {
    processUserMessage(ctx.sessionId, hasContent ? ctx.contentItems! : inbound.text ?? '')
  }

  await next()
}
