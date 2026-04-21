import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { cwd } from 'node:process'

import type Koa from 'koa'

import type { ServerEnv } from '@vibe-forge/core'

export const AUTH_COOKIE_NAME = 'vf_web_auth'

export const getAuthDataDir = (env: Pick<ServerEnv, '__VF_PROJECT_AI_SERVER_DATA_DIR__'>) =>
  resolve(cwd(), env.__VF_PROJECT_AI_SERVER_DATA_DIR__)

export const readOrCreateSecretFile = async (path: string, size: number) => {
  try {
    const existing = (await readFile(path, 'utf-8')).trim()
    if (existing !== '') {
      return existing
    }
  } catch {
    // Create the file below.
  }

  const value = randomBytes(size).toString('base64url')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${value}\n`, { encoding: 'utf-8', mode: 0o600 })
  return value
}

let generatedSecretPromise: Promise<string> | undefined

const getSessionSecret = async (env: ServerEnv) => {
  if (env.__VF_PROJECT_AI_SERVER_ACTION_SECRET__?.trim()) {
    return env.__VF_PROJECT_AI_SERVER_ACTION_SECRET__.trim()
  }

  generatedSecretPromise ??= readOrCreateSecretFile(
    resolve(getAuthDataDir(env), 'web-auth-secret'),
    32
  )
  return generatedSecretPromise
}

const sign = (payload: string, secret: string) => (
  createHmac('sha256', secret).update(payload).digest('base64url')
)

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const createSessionToken = async (env: ServerEnv, username: string, ttlMs: number) => {
  const expiresAt = Date.now() + ttlMs
  const nonce = randomBytes(16).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ username, expiresAt, nonce }), 'utf-8').toString('base64url')
  const signature = sign(payload, await getSessionSecret(env))
  return `${payload}.${signature}`
}

export const verifySessionToken = async (env: ServerEnv, token?: string | null) => {
  if (token == null || token.trim() === '') {
    return false
  }

  const [payload, signature, extra] = token.split('.')
  if (payload == null || signature == null || extra != null) {
    return false
  }

  const expectedSignature = sign(payload, await getSessionSecret(env))
  if (!safeEqual(signature, expectedSignature)) {
    return false
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      expiresAt?: unknown
    }
    return typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()
  } catch {
    return false
  }
}

export const getBearerTokenFromHeader = (authorizationHeader?: string | string[] | null) => {
  const headerValue = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
  const normalized = headerValue?.trim()
  if (normalized == null || normalized === '') {
    return undefined
  }

  const [scheme, ...tokenParts] = normalized.split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer') {
    return undefined
  }

  const token = tokenParts.join(' ').trim()
  return token === '' ? undefined : token
}

export const setAuthCookie = (
  ctx: Koa.Context,
  token: string,
  maxAgeMs?: number
) => {
  ctx.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.secure,
    ...(maxAgeMs != null ? { maxAge: maxAgeMs } : {}),
    path: '/'
  })
}

export const clearAuthCookie = (ctx: Koa.Context) => {
  ctx.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.secure,
    maxAge: 0,
    path: '/'
  })
}

export const isPasswordValid = (input: string, expected: string) => safeEqual(input, expected)

export const getCookieFromHeader = (cookieHeader: string | string[] | undefined, name: string) => {
  const headerValue = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  if (headerValue == null || headerValue.trim() === '') {
    return undefined
  }

  for (const part of headerValue.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='))
    }
  }
  return undefined
}
