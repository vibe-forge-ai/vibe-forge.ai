import cors from '@koa/cors'
import type Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { loadEnv } from '@vibe-forge/core'
import type { ServerEnv } from '@vibe-forge/core'

import { apiEnvelopeMiddleware } from './api-envelope'
import { authMiddleware } from './auth'

export async function initMiddlewares(app: Koa, env: ServerEnv = loadEnv()) {
  app.use(cors({
    origin: (ctx) => ctx.get('Origin') || '*',
    credentials: true
  }))
  app.use(apiEnvelopeMiddleware())
  app.use(bodyParser())
  app.use(authMiddleware(env))
}
