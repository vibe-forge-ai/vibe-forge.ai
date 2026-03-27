import { getServerHostEnv, getServerPortEnv } from '#~/runtime-config.js'

const DEFAULT_SERVER_PORT = '8787'
const SERVER_HOST_ENV = getServerHostEnv()
const SERVER_PORT_ENV = getServerPortEnv()

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

export interface ApiSuccessEnvelope<T> {
  success: true
  data: T
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorEnvelope {
  success: false
  error: ApiErrorPayload
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const isApiSuccessEnvelope = <T>(value: unknown): value is ApiSuccessEnvelope<T> => {
  return isRecord(value) && value.success === true && 'data' in value
}

const isApiErrorEnvelope = (value: unknown): value is ApiErrorEnvelope => {
  return isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.message === 'string' &&
    typeof value.error.code === 'string'
}

const parseResponseBody = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  if (text.trim() === '') {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const toApiError = (status: number, body: unknown, fallbackMessage: string) => {
  if (isApiErrorEnvelope(body)) {
    return new ApiError(status, body.error)
  }

  if (isRecord(body)) {
    const message = typeof body.error === 'string'
      ? body.error
      : typeof body.message === 'string'
      ? body.message
      : fallbackMessage
    const code = typeof body.code === 'string' ? body.code : 'request_failed'
    return new ApiError(status, {
      code,
      message,
      ...(body.details !== undefined ? { details: body.details } : {})
    })
  }

  if (typeof body === 'string' && body.trim() !== '') {
    return new ApiError(status, { code: 'request_failed', message: body })
  }

  return new ApiError(status, { code: 'request_failed', message: fallbackMessage })
}

const unwrapApiResponse = async <T>(res: Response, errorLabel?: string): Promise<T> => {
  const body = await parseResponseBody(res)
  if (!res.ok) {
    const fallbackMessage = errorLabel ?? `Request failed with status ${res.status}`
    const apiError = toApiError(res.status, body, fallbackMessage)
    console.error(errorLabel ?? '[api] request failed', res.status, apiError.message, apiError.details)
    throw apiError
  }

  if (isApiErrorEnvelope(body)) {
    throw new ApiError(res.status, body.error)
  }

  if (isApiSuccessEnvelope<T>(body)) {
    return body.data
  }

  return body as T
}

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError && error.message.trim() !== '') {
    return error.message
  }
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }
  return fallback
}

export async function fetchApiJson<T>(pathOrUrl: string | URL, init?: RequestInit): Promise<T> {
  const url = typeof pathOrUrl === 'string' ? buildApiUrl(pathOrUrl) : pathOrUrl.toString()
  const res = await fetch(url, init)
  return unwrapApiResponse<T>(res)
}

export async function fetchApiJsonOrThrow<T>(
  pathOrUrl: string | URL,
  init: RequestInit,
  errorLabel: string
): Promise<T> {
  const url = typeof pathOrUrl === 'string' ? buildApiUrl(pathOrUrl) : pathOrUrl.toString()
  const res = await fetch(url, init)
  return unwrapApiResponse<T>(res, errorLabel)
}
