import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/core'
import { loadAdapter } from '@vibe-forge/core'

import { prepare } from './prepare'
import type { RunTaskOptions } from './type'

declare module '@vibe-forge/core' {
  interface Cache {
    base: Omit<AdapterCtx, 'logger' | 'cache'>
  }
}

export const run = async (
  options: RunTaskOptions,
  adapterOptions: AdapterQueryOptions
) => {
  const [ctx] = await prepare(options, adapterOptions)
  const {
    configs: [config, userConfig]
  } = ctx

  const { logger, cache, ...base } = ctx

  await cache.set('base', base)

  const startTime = Date.now()
  logger.info('[Framework] Process start', {
    ...base,
    adapterOptions,
    startDateTime: new Date(startTime).toLocaleString()
  })
  const adapters = {
    ...config?.adapters,
    ...userConfig?.adapters
  }
  // dprint-ignore
  const adapterType =
    // 0. adapter from options
    options.adapter ??
    // 1. config default adapter
    config?.defaultAdapter ??
    // 2. user config default adapter
    userConfig?.defaultAdapter ??
    // 3. first adapter in config
    (() => {
      const adapterNames = Object.keys(adapters)
      if (adapterNames.length === 0) {
        throw new Error('No adapter found in config, please set adapters in config file')
      }
      return adapterNames[0]
    })()
  const adapter = await loadAdapter(adapterType)
  const session = await adapter.query(
    ctx,
    adapterOptions
  )
  return { session, ctx }
}
