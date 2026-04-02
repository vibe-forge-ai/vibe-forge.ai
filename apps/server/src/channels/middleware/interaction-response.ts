import { getSessionInteraction, handleInteractionResponse } from '#~/services/session/interaction.js'
import { getSessionLogger } from '#~/utils/logger.js'

import { syncChannelSessionBinding } from './bind-session'
import type { ChannelMiddleware } from './@types'

const splitInteractionSelections = (value: string) =>
  value
    .split(/[\n,，、]+/g)
    .map(item => item.trim())
    .filter(Boolean)

export const interactionResponseMiddleware: ChannelMiddleware = async (ctx, next) => {
  if (!ctx.sessionId) {
    await next()
    return
  }

  const interaction = getSessionInteraction(ctx.sessionId)
  if (interaction == null) {
    await next()
    return
  }

  const responseText = ctx.commandText.trim()
  if (responseText === '') {
    await ctx.reply(ctx.t('interaction.response.empty'))
    return
  }

  await ctx.inbound.ack?.().catch(() => undefined)
  syncChannelSessionBinding({
    channelKey: ctx.channelKey,
    inbound: ctx.inbound,
    sessionId: ctx.sessionId
  })

  const responseData = interaction.payload.multiselect
    ? splitInteractionSelections(responseText)
    : responseText

  getSessionLogger(ctx.sessionId, 'server').info({
    sessionId: ctx.sessionId,
    interactionId: interaction.id,
    responseType: Array.isArray(responseData) ? 'multi' : 'single',
    response: responseData
  }, '[channel] Received interaction response from channel')

  handleInteractionResponse(ctx.sessionId, interaction.id, responseData)
}
