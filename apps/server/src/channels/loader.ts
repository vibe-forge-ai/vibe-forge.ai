import { createRequire } from 'node:module'

import type { LoadedChannelModule, SafeParseSchema } from './types'

const nodeRequire = createRequire(__filename)

const resolveConnectionSpecifier = (type: string) => {
  const specifier = `@vibe-forge/channel-${type}/connection`
  void nodeRequire.resolve(specifier)
  return specifier
}

const isSafeParseSchema = (value: unknown): value is SafeParseSchema => {
  return Boolean(value) && typeof value === 'object' && typeof (value as SafeParseSchema).safeParse === 'function'
}

export const loadChannelModule = (type: string): LoadedChannelModule => {
  const specifier = resolveConnectionSpecifier(type)
  const mod = nodeRequire(specifier) as Partial<LoadedChannelModule> & { configSchema?: unknown }
  const connectChannel = mod.connectChannel
  if (typeof connectChannel !== 'function') {
    throw new TypeError(`Channel module ${specifier} must export connectChannel(config)`)
  }
  const configSchema = isSafeParseSchema(mod.configSchema) ? mod.configSchema : undefined
  return { connectChannel, configSchema }
}
