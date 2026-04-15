import type { ChatMessageContent, Session, SessionMessageQueueState, SessionQueuedMessageMode } from '@vibe-forge/core'

import { createApiUrl, fetchApiJson, fetchApiJsonOrThrow, jsonHeaders } from './base'
import type { ApiOkResponse, ApiRemoveResponse, SessionMessagesResponse } from './types'

export async function listSessions(
  filter: 'active' | 'archived' | 'all' = 'active'
): Promise<{ sessions: Session[] }> {
  const path = filter === 'archived' ? '/api/sessions/archived' : '/api/sessions'
  return fetchApiJson<{ sessions: Session[] }>(path)
}

export async function createSession(
  title?: string,
  initialMessage?: string,
  initialContent?: ChatMessageContent[],
  model?: string,
  options?: {
    start?: boolean
    parentSessionId?: string
    id?: string
    promptType?: 'spec' | 'entity'
    promptName?: string
    effort?: 'low' | 'medium' | 'high' | 'max'
    permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
    adapter?: string
  }
): Promise<{ session: Session }> {
  return fetchApiJson<{ session: Session }>('/api/sessions', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      title,
      initialMessage,
      initialContent,
      model,
      start: options?.start,
      parentSessionId: options?.parentSessionId,
      id: options?.id,
      promptType: options?.promptType,
      promptName: options?.promptName,
      effort: options?.effort,
      permissionMode: options?.permissionMode,
      adapter: options?.adapter
    })
  })
}

export async function forkSession(id: string, title?: string): Promise<{ session: Session }> {
  return fetchApiJson<{ session: Session }>(`/api/sessions/${id}/fork`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ title })
  })
}

export async function branchSessionFromMessage(
  sessionId: string,
  messageId: string,
  action: 'fork' | 'recall' | 'edit',
  options?: {
    content?: string | ChatMessageContent[]
    title?: string
  }
): Promise<{ session: Session }> {
  return fetchApiJson<{ session: Session }>(`/api/sessions/${sessionId}/messages/${messageId}/branch`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      action,
      content: options?.content,
      title: options?.title
    })
  })
}

export async function getSessionMessages(
  id: string,
  limit?: number
): Promise<SessionMessagesResponse> {
  const url = createApiUrl(`/api/sessions/${id}/messages`)
  if (limit != null) {
    url.searchParams.set('limit', limit.toString())
  }
  return fetchApiJson<SessionMessagesResponse>(url)
}

export async function respondSessionInteraction(
  sessionId: string,
  interactionId: string,
  data: string | string[]
): Promise<ApiOkResponse> {
  return fetchApiJson<ApiOkResponse>(`/api/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      type: 'interaction_response',
      id: interactionId,
      data
    })
  })
}

export async function deleteSession(id: string): Promise<ApiRemoveResponse> {
  return fetchApiJsonOrThrow<ApiRemoveResponse>(
    `/api/sessions/${id}`,
    { method: 'DELETE' },
    '[api] delete session failed:'
  )
}

export async function updateSession(id: string, data: Partial<Session>): Promise<ApiOkResponse> {
  return fetchApiJson<ApiOkResponse>(`/api/sessions/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(data)
  })
}

export async function updateSessionTitle(id: string, title: string): Promise<ApiOkResponse> {
  return updateSession(id, { title })
}

export async function createQueuedMessage(
  sessionId: string,
  mode: SessionQueuedMessageMode,
  content: ChatMessageContent[]
): Promise<{ queuedMessages: SessionMessageQueueState }> {
  return fetchApiJson<{ queuedMessages: SessionMessageQueueState }>(`/api/sessions/${sessionId}/queued-messages`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ mode, content })
  })
}

export async function updateQueuedMessage(
  sessionId: string,
  queueId: string,
  content: ChatMessageContent[]
): Promise<{ queuedMessages: SessionMessageQueueState }> {
  return fetchApiJson<{ queuedMessages: SessionMessageQueueState }>(
    `/api/sessions/${sessionId}/queued-messages/${queueId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ content })
    }
  )
}

export async function deleteQueuedMessage(
  sessionId: string,
  queueId: string
): Promise<{ queuedMessages: SessionMessageQueueState }> {
  return fetchApiJson<{ queuedMessages: SessionMessageQueueState }>(
    `/api/sessions/${sessionId}/queued-messages/${queueId}`,
    {
      method: 'DELETE'
    }
  )
}

export async function moveQueuedMessage(
  sessionId: string,
  queueId: string,
  mode: SessionQueuedMessageMode
): Promise<{ queuedMessages: SessionMessageQueueState }> {
  return fetchApiJson<{ queuedMessages: SessionMessageQueueState }>(
    `/api/sessions/${sessionId}/queued-messages/${queueId}/move`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mode })
    }
  )
}

export async function reorderQueuedMessages(
  sessionId: string,
  mode: SessionQueuedMessageMode,
  ids: string[]
): Promise<{ queuedMessages: SessionMessageQueueState }> {
  return fetchApiJson<{ queuedMessages: SessionMessageQueueState }>(
    `/api/sessions/${sessionId}/queued-messages/reorder`,
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mode, ids })
    }
  )
}
