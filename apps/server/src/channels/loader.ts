import { createRequire } from 'node:module'

import type { ChannelCreateFn, ChannelDescriptor } from '@vibe-forge/core/channel'

const nodeRequire = createRequire(__filename)

export interface LoadedChannel {
  create: ChannelCreateFn
  definition: ChannelDescriptor
}

export const loadChannelModule = (type: string): LoadedChannel => {
  const mainSpecifier = `@vibe-forge/channel-${type}`
  const connSpecifier = `@vibe-forge/channel-${type}/connection`

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

  return { create, definition }
}
