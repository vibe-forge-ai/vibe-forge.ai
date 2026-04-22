import type Koa from 'koa'

import type { ServerEnv } from '@vibe-forge/core'

import {
  AUTH_COOKIE_NAME,
  getBearerTokenFromHeader,
  resolveWebAuthConfig,
  verifySessionToken
} from '#~/services/auth/index.js'
import { unauthorized } from '#~/utils/http.js'

const PUBLIC_API_PATHS = new Set([
  '/api/auth/status',
  '/api/auth/login',
  '/api/auth/logout'
])

export const authMiddleware = (env: ServerEnv): Koa.Middleware => {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/api') || PUBLIC_API_PATHS.has(ctx.path)) {
      await next()
      return
    }

    const config = await resolveWebAuthConfig(env)
    if (!config.enabled) {
      await next()
      return
    }

    const token = getBearerTokenFromHeader(ctx.get('Authorization')) ?? ctx.cookies.get(AUTH_COOKIE_NAME)
    const authenticated = await verifySessionToken(env, token)
    if (!authenticated) {
      throw unauthorized('Login required', undefined, 'auth_required')
    }

    await next()
  }
}
