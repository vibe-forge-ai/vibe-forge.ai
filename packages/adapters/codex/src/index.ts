import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initCodexAdapter } from './runtime/init'
import { createCodexSession } from './runtime/session'

export default defineAdapter({
  init: initCodexAdapter,
  query: createCodexSession
})
