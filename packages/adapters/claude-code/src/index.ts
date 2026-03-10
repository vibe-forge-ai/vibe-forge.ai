import './adapter-config'

import { defineAdapter } from '@vibe-forge/core'

import { initClaudeCodeAdapter } from './runtime/init'
import { createClaudeSession } from './runtime/session'

export default defineAdapter({
  init: initClaudeCodeAdapter,
  query: createClaudeSession
})
