import type { AdapterQueryOptions } from '@vibe-forge/core'
import { loadAdapter } from '@vibe-forge/core'

import { prepare } from './prepare'
import type { RunTaskOptions } from './type'

declare module '@vibe-forge/core' {
  interface Cache {
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
    startTime: new Date(startTime).toLocaleString()
  })
  const adapters = {
    ...config?.adapters,
    ...userConfig?.adapters
  }
  const defaultAdapter = config?.defaultAdapter ??
    userConfig?.defaultAdapter ??
    (() => {
      if (Object.keys(adapters).length === 0) {
        throw new Error('No adapter found')
      }
      return Object.keys(adapters)[0]
    })()
  const adapter = await loadAdapter(
    options.taskAdapter ?? defaultAdapter
  )
  const session = await adapter.query(
    ctx,
    adapterOptions
  )

  return { session, ctx }
}
