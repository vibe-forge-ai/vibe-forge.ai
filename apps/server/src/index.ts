import 'dotenv/config'
import http from 'node:http'
import { exit } from 'node:process'

import cors from '@koa/cors'
import Router from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { loadEnv } from '@vibe-forge/core'

import { configRouter } from '#~/routes/config.js'
import { sessionsRouter } from '#~/routes/sessions.js'
import { setupWebSocket } from '#~/websocket/index.js'

async function bootstrap() {
  const env = loadEnv()
  const app = new Koa()

  // Middleware
  app.use(cors({ origin: '*', credentials: true }))
  app.use(bodyParser())

  // Routes
  const api = new Router()

  // Register routers
  const routers = [
    { prefix: '/api/sessions', router: sessionsRouter() },
    { prefix: '/api/config', router: configRouter() }
  ]

  for (const { prefix, router } of routers) {
    api.use(prefix, router.routes(), router.allowedMethods())
  }

  app.use(api.routes()).use(api.allowedMethods())

  // HTTP & WebSocket Server
  const handler = app.callback()
  const server = http.createServer((req, res) => {
    void handler(req, res)
  })
  setupWebSocket(server, env)

  server.listen(env.SERVER_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[server] listening on http://localhost:${env.SERVER_PORT}, ws path ${env.WS_PATH}`
    )
  })
}

bootstrap().catch((err) => {
  console.error('[server] bootstrap failed:', err)
  exit(1)
})
