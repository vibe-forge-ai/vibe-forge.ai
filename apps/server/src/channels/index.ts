import type { WSEvent } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelInboundEvent, ChannelSessionMcpServer } from '@vibe-forge/core/channel'

import { logger } from '#~/utils/logger.js'

import { handleInboundEvent, handleSessionEvent } from './handlers'
import { loadChannelModule } from './loader'
import { resolveBinding } from './state'
import { sendToolCallJsonFile } from './tool-call-file'
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

const getChannelLogContext = (key: string, type: string, configSource: 'project' | 'user') => ({
  channelKey: key,
  channelType: type,
  configSource
})

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

export const initChannels = async (
  configs: ReadonlyArray<{ channels?: Record<string, unknown> } | undefined>
): Promise<ChannelManager> => {
  const channels = collectChannelEntries(configs)
  const states = new Map<string, ChannelRuntimeState>()
  for (const [key, entry] of channels.entries()) {
    const value = entry.value
    if (value == null || typeof value !== 'object') {
      logger.warn(
        { channelKey: key, configSource: entry.source, valueType: value == null ? 'nullish' : typeof value },
        '[channels] skipped invalid channel config entry'
      )
      continue
    }
    const rawConfig = value as Record<string, unknown>
    const type = rawConfig.type
    if (typeof type !== 'string' || type === '') {
      logger.warn(
        { channelKey: key, configSource: entry.source },
        '[channels] skipped channel config without a valid type'
      )
      continue
    }

    const logContext = getChannelLogContext(key, type, entry.source)
    let connection: ChannelRuntimeState['connection']
    try {
      const mod = loadChannelModule(type)
      if (rawConfig.enabled === false) {
        states.set(key, { key, type, status: 'disabled', configSource: entry.source })
        logger.info(logContext, '[channels] channel disabled by config')
        continue
      }
      const parsed = mod.definition.configSchema.safeParse(rawConfig)
      if (parsed.success === false) {
        const error = parsed.error?.message ?? 'Invalid channel config'
        states.set(key, { key, type, status: 'error', error, configSource: entry.source })
        logger.error({ ...logContext, error }, '[channels] channel config validation failed')
        continue
      }
      const connectionConfig = parsed.success ? parsed.data : rawConfig
      connection = await mod.create(connectionConfig, { logger })
      const state: ChannelRuntimeState = {
        key,
        type,
        status: 'connected',
        connection,
        config: connectionConfig as ChannelBaseConfig,
        configSource: entry.source
      }
      await connection.startReceiving?.({
        handlers: {
          message: async (event: ChannelInboundEvent) =>
            await handleInboundEvent(key, event, connection, state.config, state.configSource)
        }
      })
      states.set(key, state)
      logger.info(logContext, '[channels] channel connected')
    } catch (err) {
      if (connection != null) {
        try {
          await connection.close?.()
        } catch (closeError) {
          logger.warn(
            { ...logContext, error: getErrorMessage(closeError) },
            '[channels] failed to close channel connection after init failure'
          )
        }
      }

      const error = getErrorMessage(err)
      states.set(key, {
        key,
        type,
        status: 'error',
        error,
        configSource: entry.source
      })
      logger.error({ ...logContext, error }, '[channels] channel initialization failed')
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

export const sendChannelToolCallJsonFile = async (
  sessionId: string,
  toolUseId: string,
  messageId?: string
) => {
  if (channelManager == null) {
    return {
      ok: false,
      statusCode: 503,
      message: 'channel manager 还没有初始化。'
    }
  }

  return await sendToolCallJsonFile(channelManager.states, {
    sessionId,
    toolUseId,
    messageId
  })
}
