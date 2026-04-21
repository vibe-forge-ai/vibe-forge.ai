import { STATUS_CODES } from 'node:http'

import type { ApiErrorResponse, ApiSuccessResponse } from '#~/utils/http.js'
import type Koa from 'koa'

import { HttpError, notFound } from '#~/utils/http.js'
import { logger } from '#~/utils/logger.js'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const getStatusMessage = (status: number) => STATUS_CODES[status] ?? 'Internal Server Error'

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

const toApiErrorResponse = (error: HttpError): ApiErrorResponse => ({
  success: false,
  error: {
    code: error.code,
    message: error.expose ? error.message : getStatusMessage(error.status),
    ...(error.details !== undefined ? { details: error.details } : {})
  }
})

const isApiResponseEnvelope = (body: unknown): body is ApiSuccessResponse<unknown> | ApiErrorResponse => {
  if (!isRecord(body) || typeof body.success !== 'boolean') {
    return false
  }

  if (body.success === true) {
    return 'data' in body
  }

  return isRecord(body.error)
}

const toLegacyErrorResponse = (body: unknown, status: number): ApiErrorResponse => {
  if (isRecord(body)) {
    const message = typeof body.error === 'string'
      ? body.error
      : typeof body.message === 'string'
      ? body.message
      : getStatusMessage(status)
    const code = typeof body.code === 'string' ? body.code : defaultCodeForStatus(status)
    return {
      success: false,
      error: {
        code,
        message,
        ...(body.details !== undefined ? { details: body.details } : {})
      }
    }
  }

  if (typeof body === 'string' && body.trim() !== '') {
    return {
      success: false,
      error: {
        code: defaultCodeForStatus(status),
        message: body
      }
    }
  }

  return {
    success: false,
    error: {
      code: defaultCodeForStatus(status),
      message: getStatusMessage(status)
    }
  }
}

const ok = <T>(data: T): ApiSuccessResponse<T> => ({ success: true, data })

const shouldSkipApiEnvelope = (ctx: Koa.Context) =>
  (ctx.state as { skipApiEnvelope?: boolean }).skipApiEnvelope === true

const normalizeHttpError = (error: unknown): HttpError => {
  if (error instanceof HttpError) {
    return error
  }

  if (isRecord(error)) {
    const status = typeof error.status === 'number' ? error.status : 500
    const expose = error.expose === true || status < 500
    const message = typeof error.message === 'string' && expose
      ? error.message
      : getStatusMessage(status)
    return new HttpError(
      status,
      typeof error.code === 'string' ? error.code : defaultCodeForStatus(status),
      message,
      error.details,
      { cause: error, expose }
    )
  }

  return new HttpError(500, 'internal_server_error', 'Internal Server Error', undefined, {
    cause: error,
    expose: false
  })
}

export const apiEnvelopeMiddleware = (): Koa.Middleware => {
  return async (ctx, next) => {
    try {
      await next()
    } catch (error) {
      if (!ctx.path.startsWith('/api')) {
        throw error
      }

      const httpError = normalizeHttpError(error)
      if (httpError.status >= 500) {
        logger.error({ err: error, method: ctx.method, path: ctx.path }, '[api] request failed')
      }

      ctx.status = httpError.status
      ctx.type = 'application/json'
      ctx.body = toApiErrorResponse(httpError)
      return
    }

    if (!ctx.path.startsWith('/api')) {
      return
    }

    if (shouldSkipApiEnvelope(ctx)) {
      return
    }

    if (ctx.status === 204 || ctx.status === 304) {
      return
    }

    ctx.type = 'application/json'

    if (isApiResponseEnvelope(ctx.body)) {
      return
    }

    if (ctx.status >= 400) {
      ctx.body = toLegacyErrorResponse(ctx.body, ctx.status)
      return
    }

    if (ctx.body === undefined) {
      if (ctx.status === 404) {
        ctx.body = toApiErrorResponse(notFound())
        return
      }
      ctx.body = ok(null)
      return
    }

    ctx.body = ok(ctx.body)
  }
}
