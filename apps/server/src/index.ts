/* eslint-disable no-console */
import http from 'node:http'
import { exit } from 'node:process'

import cors from '@koa/cors'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { loadEnv } from '@vibe-forge/core'

import { setupWebSocket } from '#~/websocket/index.js'
import { mountRoutes } from './routes'

async function init() {
  const env = loadEnv()
  const app = new Koa()
  // HTTP & WebSocket Server
  const handler = app.callback()
  const server = http.createServer((req, res) => {
    void handler(req, res)
  })

  return { app, env, server }
}

async function initMiddlewares(app: Koa) {
  app.use(cors({ origin: '*', credentials: true }))
  app.use(bodyParser())
}

async function bootstrap() {
  const { app, env, server } = await init()
  await initMiddlewares(app)
  const { onListen: mountRoutesOnListen } = await mountRoutes(app, env)
  setupWebSocket(server, env)

  const {
    __VF_PROJECT_AI_SERVER_HOST__: serverHost,
    __VF_PROJECT_AI_SERVER_PORT__: serverPort,
    __VF_PROJECT_AI_SERVER_WS_PATH__: serverWSPath
  } = env

  server.listen(serverPort, serverHost, () => {
    const host = `${serverHost}:${serverPort}`
    const httpHost = `http://${host}`
    console.log(
      `[server] listening on ${httpHost}`
    )
    console.log(
      `[server]              ws://${host}${serverWSPath}`
    )
    mountRoutesOnListen(httpHost)
  })
}

bootstrap().catch((err) => {
  console.error('[server] bootstrap failed:', err)
  exit(1)
})
