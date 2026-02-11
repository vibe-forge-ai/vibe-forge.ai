import process from 'node:process'

import type { ChatMessage, ChatMessageContent, WSEvent } from '@vibe-forge/core'

const getServerBaseUrl = () => {
  const host = process.env.__VF_PROJECT_AI_SERVER_HOST__ ?? 'localhost'
  const port = process.env.__VF_PROJECT_AI_SERVER_PORT__ ?? '8787'
  return `http://${host}:${port}`
}

export const getParentSessionId = () => {
  const ctxId = process.env.__VF_PROJECT_AI_CTX_ID__
  return ctxId ?? undefined
}

export const createChildSession = async (params: {
  id: string
  title?: string
  parentSessionId?: string
}) => {
  const baseUrl = getServerBaseUrl()
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: params.id,
      title: params.title,
      parentSessionId: params.parentSessionId,
      start: false
    })
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create session: ${response.statusText} - ${errorText}`)
  }
  return response.json()
}

export const postSessionEvent = async (sessionId: string, payload: Record<string, unknown>) => {
  const baseUrl = getServerBaseUrl()
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to post session event: ${response.statusText} - ${errorText}`)
  }
}

export const fetchSessionMessages = async (sessionId: string) => {
  const baseUrl = getServerBaseUrl()
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/messages`)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch session messages: ${response.statusText} - ${errorText}`)
  }
  const data = await response.json() as { messages: WSEvent[] }
  return data.messages ?? []
}

export const extractTextFromMessage = (message: ChatMessage): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: ChatMessageContent) => c.type === 'text')
      .map((c) => ('text' in c ? c.text : ''))
      .join('')
  }
  return ''
}
