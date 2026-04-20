import { exit } from 'node:process'

import { loadConfigState } from '#~/services/config/index.js'
import { startLocalMdpRootServer, stopLocalMdpRootServer } from '#~/services/mdp/root-server.js'
import { startServerMdpRuntime, stopServerMdpRuntime } from '#~/services/mdp/runtime.js'

import { closeChannels } from './channels'
import { startServer } from './start-server'
import { logger } from './utils/logger'

async function bootstrap() {
  const runtime = await startServer()

  runtime.server.once('close', () => {
    void closeChannels()
    void stopLocalMdpRootServer()
    void stopServerMdpRuntime()
  })

  try {
    const configState = await loadConfigState()
    await startLocalMdpRootServer({
      workspaceFolder: configState.workspaceFolder,
      mergedConfig: configState.mergedConfig
    })
    await startServerMdpRuntime({
      workspaceFolder: configState.workspaceFolder,
      mergedConfig: configState.mergedConfig
    })
  } catch (error) {
    logger.error({ error }, '[server] background runtime bootstrap failed')
  }
}

bootstrap().catch((err) => {
  logger.error('[server] bootstrap failed:', err)
  exit(1)
})
