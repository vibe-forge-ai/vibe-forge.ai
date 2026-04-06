import type { WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelInboundEvent, ChannelSessionMcpServer } from '@vibe-forge/core/channel'

import { logger } from '#~/utils/logger.js'

import { handleInboundEvent, handleSessionEvent } from './handlers'
import { loadChannelModule } from './loader'
import { resolveBinding } from './state'
import type { ChannelManager, ChannelRuntimeState } from './types'

const collectChannelEntries = (
  configs: ReadonlyArray<{ channels?: Record<string, unknown> } | undefined>
) => {
  const entries = new Map<string, { source: 'project' | 'user'; value: unknown }>()
  for (const [index, config] of configs.entries()) {
    const source = index === 0 ? 'project' : 'user'
    for (const [key, value] of Object.entries(config?.channels ?? {})) {
      entries.set(key, { source, value })
    }
  }
  return entries
}

let channelManager: ChannelManager | null = null

export const initChannels = async (
  configs: ReadonlyArray<{ channels?: Record<string, unknown> } | undefined>
): Promise<ChannelManager> => {
  const channels = collectChannelEntries(configs)
  const states = new Map<string, ChannelRuntimeState>()
  for (const [key, entry] of channels.entries()) {
    const value = entry.value
    if (value == null || typeof value !== 'object') continue
    const rawConfig = value as Record<string, unknown>
    const type = rawConfig.type
    if (typeof type !== 'string' || type === '') continue

    try {
      const mod = loadChannelModule(type)
      if (rawConfig.enabled === false) {
        states.set(key, { key, type, status: 'disabled', configSource: entry.source })
        continue
      }
      const parsed = mod.definition.configSchema.safeParse(rawConfig)
      if (parsed.success === false) {
        states.set(key, { key, type, status: 'error', error: parsed.error?.message, configSource: entry.source })
        continue
      }
      const connectionConfig = parsed.success ? parsed.data : rawConfig
      const connection = await mod.create(connectionConfig, { logger })
      const state: ChannelRuntimeState = {
        key,
        type,
        status: 'connected',
        connection,
        config: connectionConfig as ChannelBaseConfig,
        configSource: entry.source
      }
      states.set(key, state)
      await connection.startReceiving?.({
        handlers: {
          message: async (event: ChannelInboundEvent) =>
            await handleInboundEvent(key, event, connection, state.config, state.configSource)
        }
      })
    } catch (err) {
      states.set(key, {
        key,
        type,
        status: 'error',
        error: String((err as Error).message ?? err),
        configSource: entry.source
      })
    }
  }

  const closeAll = async () => {
    for (const state of states.values()) {
      await state.connection?.close?.()
    }
  }

  const manager: ChannelManager = {
    states,
    handleSessionEvent: async (sessionId: string, event: WSEvent) => await handleSessionEvent(states, sessionId, event),
    closeAll
  }
  channelManager = manager
  return manager
}

export const handleChannelSessionEvent = async (sessionId: string, event: WSEvent) => {
  if (!channelManager) return false
  return await channelManager.handleSessionEvent(sessionId, event)
}

export const resolveChannelSessionMcpServers = async (sessionId: string) => {
  if (!channelManager) {
    return {} satisfies Record<string, ChannelSessionMcpServer['config']>
  }

  const binding = resolveBinding(sessionId)
  if (binding == null) {
    return {} satisfies Record<string, ChannelSessionMcpServer['config']>
  }

  const state = channelManager.states.get(binding.channelKey)
  if (state?.config == null) {
    return {} satisfies Record<string, ChannelSessionMcpServer['config']>
  }

  const mod = loadChannelModule(state.type)
  const servers = await mod.resolveSessionMcpServers?.(state.config, {
    sessionId,
    channelKey: binding.channelKey,
    channelType: binding.channelType,
    channelId: binding.channelId,
    sessionType: binding.sessionType,
    replyReceiveId: binding.replyReceiveId,
    replyReceiveIdType: binding.replyReceiveIdType
  })

  return Object.fromEntries(
    (servers ?? []).map(server => [server.name, server.config])
  ) satisfies Record<string, ChannelSessionMcpServer['config']>
}
