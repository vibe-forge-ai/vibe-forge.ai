import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { initGeminiAdapter } from './runtime/init'
import { createGeminiSession } from './runtime/session'

export default defineAdapter({
  init: initGeminiAdapter,
  query: createGeminiSession
})
