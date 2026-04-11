import { createRequire } from 'node:module'

import type { ChannelCreateFn, ChannelDescriptor, ResolveChannelSessionMcpServersFn } from '@vibe-forge/core/channel'

const nodeRequire = createRequire(__filename)

export interface LoadedChannel {
  create: ChannelCreateFn
  definition: ChannelDescriptor
  resolveSessionMcpServers?: ResolveChannelSessionMcpServersFn
}

const isOptionalMcpModuleMissing = (error: unknown, specifier: string) =>
  error instanceof Error &&
  'code' in error &&
  error.code === 'MODULE_NOT_FOUND' &&
  error.message.includes(specifier)

export const loadChannelModule = (type: string): LoadedChannel => {
  const mainSpecifier = `@vibe-forge/channel-${type}`
  const connSpecifier = `@vibe-forge/channel-${type}/connection`
  const mcpSpecifier = `@vibe-forge/channel-${type}/mcp`

  const mainMod = nodeRequire(mainSpecifier) as {
    channelDefinition?: ChannelDescriptor
  }
  const definition = mainMod.channelDefinition
  if (definition == null) {
    throw new TypeError(`${mainSpecifier} must export channelDefinition`)
  }

  const connMod = nodeRequire(connSpecifier) as {
    createChannelConnection?: ChannelCreateFn
  }
  const create = connMod.createChannelConnection
  if (typeof create !== 'function') {
    throw new TypeError(`${connSpecifier} must export createChannelConnection`)
  }

  let resolveSessionMcpServers: ResolveChannelSessionMcpServersFn | undefined
  try {
    const mcpMod = nodeRequire(mcpSpecifier) as {
      resolveChannelSessionMcpServers?: ResolveChannelSessionMcpServersFn
    }
    if (typeof mcpMod.resolveChannelSessionMcpServers === 'function') {
      resolveSessionMcpServers = mcpMod.resolveChannelSessionMcpServers
    }
  } catch (error) {
    if (!isOptionalMcpModuleMissing(error, mcpSpecifier)) {
      throw error
    }
  }

  return { create, definition, resolveSessionMcpServers }
}
