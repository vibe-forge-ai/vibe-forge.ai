import { exit } from 'node:process'

import { startServer } from './start-server'
import { logger } from './utils/logger'

startServer().catch((err) => {
  logger.error('[server] bootstrap failed:', err)
  exit(1)
})
