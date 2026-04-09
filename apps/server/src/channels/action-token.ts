import { Buffer } from 'node:buffer'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { getDb } from '#~/db/index.js'

import { MissingChannelActionSecretError, resolveActionTokenSecret } from './action-token-secret.js'

const DEFAULT_DETAIL_TOKEN_TTL_MS = 60 * 60 * 1000
const DEFAULT_EXPORT_TOKEN_TTL_MS = 15 * 60 * 1000

export interface ChannelActionTokenClaims {
  action: string
  sessionId: string
  toolUseId?: string
  messageId?: string
  exp: number
  nonce?: string
  oneTime?: boolean
}

export interface ChannelActionTokenInput {
  action: string
  sessionId: string
  toolUseId?: string
  messageId?: string
  ttlMs?: number
  oneTime?: boolean
}

export type ChannelActionTokenErrorCode =
  'missing' | 'malformed' | 'invalid' | 'expired' | 'action_mismatch' | 'replayed' | 'unavailable'

type ChannelActionTokenResult =
  | { ok: true; claims: ChannelActionTokenClaims }
  | { ok: false; code: ChannelActionTokenErrorCode }

const encodeBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url')

const decodeBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

const signTokenPayload = (encodedPayload: string) => (
  createHmac('sha256', resolveActionTokenSecret()).update(encodedPayload).digest('base64url')
)

const compareSignature = (expected: string, actual: string) => {
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const actualBuffer = Buffer.from(actual, 'utf8')
  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, actualBuffer)
}

const parseClaims = (payload: unknown): ChannelActionTokenClaims | undefined => {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined
  }
  const record = payload as Record<string, unknown>

  const action = typeof record.action === 'string' ? record.action.trim() : ''
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : ''
  const exp = typeof record.exp === 'number' ? record.exp : Number.NaN
  if (action === '' || sessionId === '' || !Number.isFinite(exp)) {
    return undefined
  }

  const toolUseId = typeof record.toolUseId === 'string' && record.toolUseId.trim() !== ''
    ? record.toolUseId.trim()
    : undefined
  const messageId = typeof record.messageId === 'string' && record.messageId.trim() !== ''
    ? record.messageId.trim()
    : undefined
  const nonce = typeof record.nonce === 'string' && record.nonce.trim() !== ''
    ? record.nonce.trim()
    : undefined

  return {
    action,
    sessionId,
    toolUseId,
    messageId,
    exp,
    nonce,
    oneTime: record.oneTime === true
  }
}

const verifyActionTokenInternal = (
  token: string | undefined,
  expectedAction: string,
  options?: {
    consume?: boolean
  }
): ChannelActionTokenResult => {
  const normalizedToken = token?.trim()
  if (normalizedToken == null || normalizedToken === '') {
    return { ok: false, code: 'missing' }
  }

  const [encodedPayload, signature, extra] = normalizedToken.split('.')
  if (
    encodedPayload == null ||
    signature == null ||
    encodedPayload === '' ||
    signature === '' ||
    extra != null
  ) {
    return { ok: false, code: 'malformed' }
  }

  let expectedSignature: string
  try {
    expectedSignature = signTokenPayload(encodedPayload)
  } catch (error) {
    if (error instanceof MissingChannelActionSecretError) {
      return { ok: false, code: 'unavailable' }
    }
    throw error
  }
  if (!compareSignature(expectedSignature, signature)) {
    return { ok: false, code: 'invalid' }
  }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(decodeBase64Url(encodedPayload)) as unknown
  } catch {
    return { ok: false, code: 'malformed' }
  }

  const claims = parseClaims(parsedPayload)
  if (claims == null) {
    return { ok: false, code: 'malformed' }
  }
  if (claims.action !== expectedAction) {
    return { ok: false, code: 'action_mismatch' }
  }

  const now = Date.now()
  if (claims.exp <= now) {
    return { ok: false, code: 'expired' }
  }

  if (options?.consume === true && claims.oneTime === true) {
    if (claims.nonce == null) {
      return { ok: false, code: 'invalid' }
    }
    if (!getDb().consumeChannelActionTokenNonce(claims.nonce, claims.action, claims.exp, now)) {
      return { ok: false, code: 'replayed' }
    }
  }

  return { ok: true, claims }
}

export const createChannelActionToken = (input: ChannelActionTokenInput) => {
  const now = Date.now()
  const oneTime = input.oneTime ?? input.action === 'tool-call-export'
  const ttlMs = input.ttlMs ?? (oneTime ? DEFAULT_EXPORT_TOKEN_TTL_MS : DEFAULT_DETAIL_TOKEN_TTL_MS)
  const claims: ChannelActionTokenClaims = {
    action: input.action.trim(),
    sessionId: input.sessionId,
    toolUseId: input.toolUseId?.trim() || undefined,
    messageId: input.messageId?.trim() || undefined,
    exp: now + Math.max(1, ttlMs),
    oneTime,
    nonce: oneTime ? randomUUID() : undefined
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(claims))
  const signature = signTokenPayload(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export const tryCreateChannelActionToken = (input: ChannelActionTokenInput) => {
  try {
    return createChannelActionToken(input)
  } catch (error) {
    if (error instanceof MissingChannelActionSecretError) {
      return undefined
    }
    throw error
  }
}

export const verifyChannelActionToken = (
  token: string | undefined,
  expectedAction: string
) => verifyActionTokenInternal(token, expectedAction)

export const consumeChannelActionToken = (
  token: string | undefined,
  expectedAction: string
) => verifyActionTokenInternal(token, expectedAction, { consume: true })

export const resetChannelActionTokenStateForTests = () => {
  getDb().clearChannelActionTokenNonces()
}
