import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initCopilotAdapter } from './runtime/init'
import { createCopilotSession } from './runtime/session'

export default defineAdapter({
  init: initCopilotAdapter,
  query: createCopilotSession
})
