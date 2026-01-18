const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || window.location.hostname
const SERVER_PORT = import.meta.env.VITE_SERVER_PORT || '8787'
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`

export async function listProjects() {
  const res = await fetch(`${SERVER_URL}/api/projects`)
  return res.json()
}

export async function createProject(name?: string) {
  const res = await fetch(`${SERVER_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return res.json()
}

export async function listSessions() {
  const res = await fetch(`${SERVER_URL}/api/sessions`)
  return res.json()
}

export async function createSession(title?: string) {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  return res.json()
}

export async function getConfig() {
  const res = await fetch(`${SERVER_URL}/api/config`)
  return res.json()
}

export async function deleteSession(id: string) {
  const url = `${SERVER_URL}/api/sessions/${id}`
  console.log('[api] deleting session:', url)
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    console.error('[api] delete failed:', res.status, text)
    throw new Error(`Delete failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function updateSessionTitle(id: string, title: string) {
  const res = await fetch(`${SERVER_URL}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })
  return res.json()
}
