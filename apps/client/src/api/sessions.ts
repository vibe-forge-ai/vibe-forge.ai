import type { Session } from '@vibe-forge/core'

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
  model?: string,
  options?: { start?: boolean; parentSessionId?: string; id?: string }
): Promise<{ session: Session }> {
  return fetchApiJson<{ session: Session }>('/api/sessions', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      title,
      initialMessage,
      model,
      start: options?.start,
      parentSessionId: options?.parentSessionId,
      id: options?.id
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
