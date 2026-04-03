import { getSessionInteraction, handleInteractionResponse } from '#~/services/session/interaction.js'
import { getSessionLogger } from '#~/utils/logger.js'

import {
  formatInteractionChoices,
  getInteractionResponseMode,
  resolveInteractionSelection,
  splitInteractionSelections
} from '#~/channels/interaction.js'

import { syncChannelSessionBinding } from './bind-session'
import type { ChannelContext, ChannelMiddleware } from './@types'

const buildInteractionInvalidReply = (
  ctx: ChannelContext,
  input: {
    multiselect: boolean
    choices: string
    invalidSelections?: string[]
  }
) => {
  if (input.multiselect) {
    return ctx.t('interaction.response.invalidMulti', {
      invalid: (input.invalidSelections ?? []).join('、'),
      choices: input.choices
    })
  }

  return ctx.t('interaction.response.invalidSingle', {
    choices: input.choices
  })
}

type InteractionOption = Parameters<typeof resolveInteractionSelection>[1][number]

const resolveControlledInteractionResponse = async (
  ctx: ChannelContext,
  input: {
    options: InteractionOption[]
    responseText: string
    multiselect?: boolean
  }
) => {
  const choices = formatInteractionChoices(input.options)

  if (input.multiselect) {
    const selections = splitInteractionSelections(input.responseText)
    const resolvedSelections = selections.map(selection => ({
      raw: selection,
      resolved: resolveInteractionSelection(selection, input.options)
    }))
    const invalidSelections = resolvedSelections
      .filter(selection => selection.resolved == null)
      .map(selection => selection.raw)

    if (resolvedSelections.length === 0 || invalidSelections.length > 0) {
      await ctx.reply(buildInteractionInvalidReply(ctx, {
        multiselect: true,
        choices,
        invalidSelections
      }))
      return undefined
    }

    return [...new Set(resolvedSelections.map(selection => selection.resolved!))]
  }

  const resolved = resolveInteractionSelection(input.responseText, input.options)
  if (resolved == null) {
    await ctx.reply(buildInteractionInvalidReply(ctx, {
      multiselect: false,
      choices
    }))
    return undefined
  }

  return resolved
}

const resolveFreeformInteractionResponse = (
  input: {
    options: InteractionOption[]
    responseText: string
    multiselect?: boolean
  }
) => {
  if (input.multiselect) {
    return splitInteractionSelections(input.responseText).map((selection) => {
      return resolveInteractionSelection(selection, input.options) ?? selection
    })
  }

  return resolveInteractionSelection(input.responseText, input.options) ?? input.responseText
}

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

  const options = interaction.payload.options ?? []
  const responseMode = getInteractionResponseMode(interaction.payload.kind)
  let responseData: string | string[]

  if (options.length > 0) {
    if (responseMode === 'controlled') {
      const resolved = await resolveControlledInteractionResponse(ctx, {
        options,
        responseText,
        multiselect: interaction.payload.multiselect
      })
      if (resolved == null) {
        return
      }
      responseData = resolved
    } else {
      responseData = resolveFreeformInteractionResponse({
        options,
        responseText,
        multiselect: interaction.payload.multiselect
      })
    }
  } else {
    responseData = interaction.payload.multiselect
      ? splitInteractionSelections(responseText)
      : responseText
  }

  await ctx.inbound.ack?.().catch(() => undefined)
  syncChannelSessionBinding({
    channelKey: ctx.channelKey,
    inbound: ctx.inbound,
    sessionId: ctx.sessionId
  })

  getSessionLogger(ctx.sessionId, 'server').info({
    sessionId: ctx.sessionId,
    interactionId: interaction.id,
    responseType: Array.isArray(responseData) ? 'multi' : 'single',
    response: responseData
  }, '[channel] Received interaction response from channel')

  handleInteractionResponse(ctx.sessionId, interaction.id, responseData)
}
