import { getClientBase } from '#~/runtime-config.js'

const normalizeSessionPath = (sessionId: string) => `${getClientBase()}/session/${sessionId}`

export const getMessageAnchorId = (messageId: string, part?: string) => {
  const suffix = part?.trim()
  return suffix != null && suffix !== '' ? `message-${messageId}-${suffix}` : `message-${messageId}`
}

export const buildSessionUrl = (
  sessionId: string,
  options?: {
    anchorId?: string
  }
) => {
  const url = new URL(globalThis.location.origin)
  url.pathname = normalizeSessionPath(sessionId)
  url.search = ''
  url.hash = options?.anchorId != null && options.anchorId !== '' ? `#${options.anchorId}` : ''
  return url.toString()
}
