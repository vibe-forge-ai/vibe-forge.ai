import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initOpenCodeAdapter } from './runtime/init'
import { createOpenCodeSession } from './runtime/session'

export default defineAdapter({
  init: initOpenCodeAdapter,
  query: createOpenCodeSession
})
