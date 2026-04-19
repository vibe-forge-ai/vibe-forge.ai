import Router from '@koa/router'

import type { ServerEnv } from '@vibe-forge/core'

import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  createSessionToken,
  findMatchingAccount,
  resolveWebAuthConfig,
  setAuthCookie,
  toAuthPublicStatus,
  verifySessionToken
} from '#~/services/auth/index.js'
import { badRequest, unauthorized } from '#~/utils/http.js'

export function authRouter(env: ServerEnv): Router {
  const router = new Router()

  router.get('/status', async (ctx) => {
    const config = await resolveWebAuthConfig(env)
    const authenticated = await verifySessionToken(env, ctx.cookies.get(AUTH_COOKIE_NAME))
    ctx.body = toAuthPublicStatus(config, authenticated)
  })

  router.post('/login', async (ctx) => {
    const config = await resolveWebAuthConfig(env)
    if (!config.enabled) {
      ctx.body = toAuthPublicStatus(config, true)
      return
    }

    const body = ctx.request.body as { username?: unknown; password?: unknown; rememberDevice?: unknown } | undefined
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const rememberDevice = body?.rememberDevice === true
    if (username === '' || password === '') {
      throw badRequest('Username and password are required', undefined, 'auth_missing_credentials')
    }

    const account = findMatchingAccount(config, username, password)
    if (account == null) {
      throw unauthorized('Invalid username or password', undefined, 'auth_invalid_credentials')
    }

    const ttlMs = rememberDevice ? config.rememberDeviceTtlMs : config.sessionTtlMs
    const token = await createSessionToken(env, account.username, ttlMs)
    setAuthCookie(ctx, token, rememberDevice ? ttlMs : undefined)
    ctx.body = toAuthPublicStatus(config, true)
  })

  router.post('/logout', (ctx) => {
    clearAuthCookie(ctx)
    ctx.body = { ok: true }
  })

  return router
}
