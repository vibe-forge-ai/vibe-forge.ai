import type { Session } from '@vibe-forge/core'

const SERVER_HOST = (import.meta.env.VITE_SERVER_HOST as string | undefined) ?? window.location.hostname
const SERVER_PORT = (import.meta.env.VITE_SERVER_PORT as string | undefined) ?? '8787'
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`

export async function listProjects(): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/projects`)
  return res.json()
}

export async function createProject(name?: string): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return res.json()
}

export async function listSessions(filter: 'active' | 'archived' | 'all' = 'active'): Promise<{ sessions: Session[] }> {
  const res = await fetch(`${SERVER_URL}/api/sessions${filter === 'archived' ? '/archived' : ''}`)
  return res.json() as Promise<{ sessions: Session[] }>
}

export async function createSession(title?: string): Promise<{ session: Session }> {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  return res.json() as Promise<{ session: Session }>
}

export async function getConfig(): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/config`)
  return res.json()
}

export async function deleteSession(id: string): Promise<{ success: boolean }> {
  const url = `${SERVER_URL}/api/sessions/${id}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    console.error('[api] delete failed:', res.status, text)
    throw new Error(`Delete failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<{ success: boolean }>
}

export async function updateSession(id: string, data: Partial<Session>): Promise<{ ok: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json() as Promise<{ ok: boolean }>
}

export async function updateSessionTitle(id: string, title: string): Promise<{ session: Session }> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  return res.json() as Promise<{ session: Session }>
}

export async function getSessionMessages(id: string, limit?: number): Promise<{ messages: any[] }> {
  const url = new URL(`${SERVER_URL}/api/sessions/${id}/messages`)
  if (limit != null) {
    url.searchParams.set('limit', limit.toString())
  }
  const res = await fetch(url.toString())
  return res.json() as Promise<{ messages: any[] }>
}
