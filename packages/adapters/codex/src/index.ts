import './adapter-config'

import { defineAdapter } from '@vibe-forge/types'

import { getCodexAccounts } from './runtime/accounts'
import { initCodexAdapter } from './runtime/init'
import { createCodexSession } from './runtime/session'

export default defineAdapter({
  init: initCodexAdapter,
  getAccounts: getCodexAccounts,
  query: createCodexSession
})
