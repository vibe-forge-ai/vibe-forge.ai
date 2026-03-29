import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initClaudeCodeAdapter } from './runtime/init'
import { createClaudeSession } from './runtime/session'

export default defineAdapter({
  init: initClaudeCodeAdapter,
  query: createClaudeSession
})
