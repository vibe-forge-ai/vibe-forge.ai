const DEFAULT_SERVER_PORT = '8787'
const SERVER_HOST_ENV = import.meta.env.__VF_PROJECT_AI_SERVER_HOST__ as string | undefined
const SERVER_PORT_ENV = import.meta.env.__VF_PROJECT_AI_SERVER_PORT__ as string | undefined

export const jsonHeaders = { 'Content-Type': 'application/json' } as const

export const getServerHost = () => {
  if (SERVER_HOST_ENV != null && SERVER_HOST_ENV !== '') {
    return SERVER_HOST_ENV
  }
  return window.location.hostname
}

export const getServerPort = () => {
  if (SERVER_PORT_ENV != null && SERVER_PORT_ENV !== '') {
    return SERVER_PORT_ENV
  }
  return DEFAULT_SERVER_PORT
}

export const getServerUrl = () => `http://${getServerHost()}:${getServerPort()}`

export const buildApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getServerUrl()}${normalized}`
}

export const createApiUrl = (path: string) => new URL(buildApiUrl(path))

export async function fetchApiJson<T>(pathOrUrl: string | URL, init?: RequestInit): Promise<T> {
  const url = typeof pathOrUrl === 'string' ? buildApiUrl(pathOrUrl) : pathOrUrl.toString()
  const res = await fetch(url, init)
  return res.json() as Promise<T>
}

export async function fetchApiJsonOrThrow<T>(
  pathOrUrl: string | URL,
  init: RequestInit,
  errorLabel: string
): Promise<T> {
  const url = typeof pathOrUrl === 'string' ? buildApiUrl(pathOrUrl) : pathOrUrl.toString()
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text()
    console.error(errorLabel, res.status, text)
    throw new Error(`${errorLabel} ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}
