import http from 'node:http'
import process, { exit } from 'node:process'

import cors from '@koa/cors'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { loadConfig, loadEnv } from '@vibe-forge/core'

import { initChannels } from './channels'
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
  const workspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  const jsonVariables: Record<string, string | null | undefined> = {
    ...process.env,
    WORKSPACE_FOLDER: workspaceFolder,
    __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
  }
  const configs = await loadConfig({ jsonVariables })

  return { app, env, server, configs }
}

async function initMiddlewares(app: Koa) {
  app.use(cors({ origin: '*', credentials: true }))
  app.use(bodyParser())
}

async function bootstrap() {
  const { app, env, server, configs } = await init()
  await initMiddlewares(app)
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
