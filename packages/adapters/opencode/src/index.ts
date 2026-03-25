import './adapter-config'

import { defineAdapter } from '@vibe-forge/core/adapter'

import { initOpenCodeAdapter } from './runtime/init'
import { createOpenCodeSession } from './runtime/session'

export default defineAdapter({
  init: initOpenCodeAdapter,
  query: createOpenCodeSession
})
