import type { ChannelBaseConfig, ChannelConnection, ChannelInboundEvent } from '@vibe-forge/core/channel'

import type { ChannelTextMessage } from '#~/channels/middleware/@types/index.js'

import { loadChannelAgentRules } from './agent-rules'
import { buildChannelContextPrompt } from './context'

export const buildSessionSystemPrompt = async (
  inbound: ChannelInboundEvent,
  config: ChannelBaseConfig | undefined,
  connection: ChannelConnection<ChannelTextMessage> | undefined
): Promise<string | undefined> => {
  const [channelRulesPrompt, connectionSystemPrompt] = await Promise.all([
    loadChannelAgentRules(inbound.channelType),
    connection?.generateSystemPrompt?.(inbound)
  ])
  return [
    config?.systemPrompt,
    buildChannelContextPrompt(inbound, config),
    channelRulesPrompt,
    connectionSystemPrompt
  ]
    .filter(Boolean)
    .join('\n\n') || undefined
}
