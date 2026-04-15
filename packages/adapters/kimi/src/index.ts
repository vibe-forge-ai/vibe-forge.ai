import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { createDirectKimiSession } from './runtime/direct'
import { initKimiAdapter } from './runtime/init'
import { createKimiSession } from './runtime/session'

export default defineAdapter({
  init: initKimiAdapter,
  query: async (ctx, options) => (
    options.mode === 'direct'
      ? createDirectKimiSession(ctx, options)
      : createKimiSession(ctx, options)
  )
})
