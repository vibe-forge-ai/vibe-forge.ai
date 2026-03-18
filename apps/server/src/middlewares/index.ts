import cors from '@koa/cors'
import type Koa from 'koa'
import bodyParser from 'koa-bodyparser'

import { apiEnvelopeMiddleware } from './api-envelope'

export async function initMiddlewares(app: Koa) {
  app.use(cors({ origin: '*', credentials: true }))
  app.use(apiEnvelopeMiddleware())
  app.use(bodyParser())
}
