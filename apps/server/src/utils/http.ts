export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  success: false
  error: ApiErrorPayload
}

export class HttpError extends Error {
  status: number
  code: string
  details?: unknown
  expose: boolean

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    options?: { cause?: unknown; expose?: boolean }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
    this.expose = options?.expose ?? status < 500
  }
}

const defaultCodeForStatus = (status: number) => {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 405:
      return 'method_not_allowed'
    case 408:
      return 'request_timeout'
    case 409:
      return 'conflict'
    case 422:
      return 'unprocessable_entity'
    default:
      return status >= 500 ? 'internal_server_error' : 'request_failed'
  }
}

const createHttpError = (
  status: number,
  message: string,
  options?: { code?: string; details?: unknown; cause?: unknown; expose?: boolean }
) => {
  return new HttpError(
    status,
    options?.code ?? defaultCodeForStatus(status),
    message,
    options?.details,
    { cause: options?.cause, expose: options?.expose }
  )
}

export const badRequest = (message = 'Bad Request', details?: unknown, code?: string) =>
  createHttpError(400, message, { details, code })

export const unauthorized = (message = 'Unauthorized', details?: unknown, code?: string) =>
  createHttpError(401, message, { details, code })

export const notFound = (message = 'Not Found', details?: unknown, code?: string) =>
  createHttpError(404, message, { details, code })

export const methodNotAllowed = (message = 'Method Not Allowed', details?: unknown, code?: string) =>
  createHttpError(405, message, { details, code })

export const requestTimeout = (message = 'Request Timeout', details?: unknown, code?: string) =>
  createHttpError(408, message, { details, code })

export const conflict = (message = 'Conflict', details?: unknown, code?: string) =>
  createHttpError(409, message, { details, code })

export const internalServerError = (
  message = 'Internal Server Error',
  options?: { code?: string; details?: unknown; cause?: unknown }
) => createHttpError(500, message, { ...options, expose: true })

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError
