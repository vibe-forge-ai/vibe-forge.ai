import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initClaudeCodeAdapter } from './claude/init'
import { createClaudeSession } from './claude/session'

export default defineAdapter({
  init: initClaudeCodeAdapter,
  query: createClaudeSession
})
