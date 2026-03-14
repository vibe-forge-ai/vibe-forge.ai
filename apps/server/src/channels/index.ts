import type { WSEvent } from '@vibe-forge/core'
import type { ChannelInboundEvent } from '@vibe-forge/core/channel'

import { logger } from '#~/utils/logger.js'

import { handleInboundEvent, handleSessionEvent } from './handlers'
import { loadChannelModule } from './loader'
import type { ChannelManager, ChannelRuntimeState } from './types'

let channelManager: ChannelManager | null = null

export const initChannels = async (
  configs: ReadonlyArray<{ channels?: Record<string, unknown> } | undefined>
): Promise<ChannelManager> => {
  const channels = configs.reduce<Record<string, unknown>>((acc, config) => {
    return {
      ...acc,
      ...(config?.channels ?? {})
    }
  }, {})
  const states = new Map<string, ChannelRuntimeState>()
  for (const [key, value] of Object.entries(channels)) {
    if (value == null || typeof value !== 'object') continue
    const rawConfig = value as Record<string, unknown>
    const type = rawConfig.type
    if (typeof type !== 'string' || type === '') continue

    try {
      const mod = loadChannelModule(type)
      if (rawConfig.enabled === false) {
        states.set(key, { key, type, status: 'disabled' })
        continue
      }
      const parsed = mod.configSchema?.safeParse(rawConfig)
      if (parsed && parsed.success === false) {
        states.set(key, { key, type, status: 'error', error: parsed.error?.message })
        continue
      }
      const connectionConfig = parsed && parsed.success === true ? parsed.data : rawConfig
      const connection = await mod.connectChannel(connectionConfig, { logger })
      states.set(key, { key, type, status: 'connected', connection })
      await connection.startReceiving?.({
        handlers: {
          message: async (event: ChannelInboundEvent) => await handleInboundEvent(key, event, connection)
        }
      })
    } catch (err) {
      states.set(key, { key, type, status: 'error', error: String((err as Error).message ?? err) })
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
  if (!channelManager) return
  await channelManager.handleSessionEvent(sessionId, event)
}
