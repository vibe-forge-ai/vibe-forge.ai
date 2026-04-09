export interface ChannelActionTokenClaims {
  action: string
  sessionId: string
  sessionUrl?: string
  toolUseId?: string
  messageId?: string
  exp: number
  nonce?: string
  oneTime?: boolean
}

export interface ChannelActionTokenInput {
  action: string
  sessionId: string
  sessionUrl?: string
  toolUseId?: string
  messageId?: string
  ttlMs?: number
  oneTime?: boolean
}

export const parseChannelActionTokenClaims = (payload: unknown): ChannelActionTokenClaims | undefined => {
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

  return {
    action,
    sessionId,
    sessionUrl: typeof record.sessionUrl === 'string' && record.sessionUrl.trim() !== ''
      ? record.sessionUrl.trim()
      : undefined,
    toolUseId: typeof record.toolUseId === 'string' && record.toolUseId.trim() !== ''
      ? record.toolUseId.trim()
      : undefined,
    messageId: typeof record.messageId === 'string' && record.messageId.trim() !== ''
      ? record.messageId.trim()
      : undefined,
    exp,
    nonce: typeof record.nonce === 'string' && record.nonce.trim() !== ''
      ? record.nonce.trim()
      : undefined,
    oneTime: record.oneTime === true
  }
}
