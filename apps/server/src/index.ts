import http from 'node:http'
import { exit } from 'node:process'

import Koa from 'koa'

import { loadEnv } from '@vibe-forge/core'

import { loadConfigState } from '#~/services/config/index.js'

import { initChannels } from './channels'
import { initMiddlewares } from './middlewares'
import { mountRoutes } from './routes'
import { logger } from './utils/logger'
import { setupWebSocket } from './websocket'

async function init() {
  const env = loadEnv()
  const app = new Koa()
  // HTTP & WebSocket Server
  const handler = app.callback()
  const server = http.createServer((req, res) => {
    void handler(req, res)
  })
  const { projectConfig, userConfig } = await loadConfigState()
  const configs = [projectConfig, userConfig] as const

  return { app, env, server, configs }
}

async function bootstrap() {
  const { app, env, server, configs } = await init()
  await initMiddlewares(app, env)
  const { onListen: mountRoutesOnListen } = await mountRoutes(app, env)
  setupWebSocket(server, env)
  await initChannels(configs)

  const {
    __VF_PROJECT_AI_SERVER_HOST__: serverHost,
    __VF_PROJECT_AI_SERVER_PORT__: serverPort,
    __VF_PROJECT_AI_SERVER_WS_PATH__: serverWSPath
  } = env

  server.listen(serverPort, serverHost, () => {
    const host = `${serverHost}:${serverPort}`
    const httpHost = `http://${host}`
    logger.info(
      `[server] listening on ${httpHost}`
    )
    logger.info(
      `[server]              ws://${host}${serverWSPath}`
    )
    mountRoutesOnListen(httpHost)
  })
}

bootstrap().catch((err) => {
  logger.error('[server] bootstrap failed:', err)
  exit(1)
})
