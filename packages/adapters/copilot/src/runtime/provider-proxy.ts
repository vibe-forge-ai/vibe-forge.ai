import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { createLogger } from '@vibe-forge/utils/create-logger'
import type { Logger } from '@vibe-forge/utils/create-logger'

interface CopilotProviderProxyLogContext {
  cwd: string
  ctxId: string
  sessionId: string
}

export interface CopilotProviderProxyRoute {
  upstreamBaseUrl: string
  queryParams?: Record<string, string>
  headers?: Record<string, string>
  logContext?: CopilotProviderProxyLogContext
  diagnostics?: Record<string, unknown>
}

const REQUEST_HEADERS_TO_DROP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

const RESPONSE_HEADERS_TO_DROP = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

const SENSITIVE_LOG_KEY_PATTERNS = [
  /^authorization$/i,
  /^proxy-authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /^api[-_]?key$/i,
  /^key$/i,
  /token$/i,
  /secret$/i,
  /password$/i
]

let proxyServerPromise: Promise<{ baseUrl: string }> | undefined
let proxyServerLogger: Logger | undefined
let proxyRouteCounter = 0
let proxyRequestCounter = 0

const routes = new Map<string, CopilotProviderProxyRoute>()
const requestLoggerCache = new Map<string, Logger>()

const isSensitiveLogKey = (key: string) => SENSITIVE_LOG_KEY_PATTERNS.some(pattern => pattern.test(key))

const normalizeHeaderValue = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value.join(', ') : value
)

const sanitizeHeaderEntriesForLog = (
  entries: Iterable<[string, string]>
) =>
  Object.fromEntries(
    Array.from(entries, ([key, value]) => [key, isSensitiveLogKey(key) ? '[REDACTED]' : value])
  )

const sanitizeIncomingHeadersForLog = (
  headers: IncomingMessage['headers']
) =>
  Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key, normalizeHeaderValue(value)] as const)
      .filter((entry): entry is [string, string] => entry[1] != null)
      .map(([key, value]) => [key, isSensitiveLogKey(key) ? '[REDACTED]' : value] as const)
  )

const readRequestBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const writeJsonError = (
  res: ServerResponse,
  statusCode: number,
  message: string
) => {
  if (res.headersSent) {
    res.end()
    return
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify({
    error: {
      message
    }
  }))
}

const normalizeBaseUrl = (value: string) => (
  value.endsWith('/') ? value.slice(0, -1) : value
)

const buildUpstreamUrl = (
  route: CopilotProviderProxyRoute,
  requestPath: string,
  searchParams: URLSearchParams
) => {
  const upstreamUrl = new URL(`${normalizeBaseUrl(route.upstreamBaseUrl)}${requestPath}`)
  for (const [key, value] of searchParams.entries()) {
    upstreamUrl.searchParams.append(key, value)
  }
  for (const [key, value] of Object.entries(route.queryParams ?? {})) {
    upstreamUrl.searchParams.set(key, value)
  }
  return upstreamUrl
}

const getRequestLogger = (logContext: CopilotProviderProxyLogContext | undefined) => {
  if (logContext == null) return undefined
  const cacheKey = `${logContext.cwd}\n${logContext.ctxId}\n${logContext.sessionId}`
  const cached = requestLoggerCache.get(cacheKey)
  if (cached != null) return cached
  const logger = createLogger(
    logContext.cwd,
    `${logContext.ctxId}/${logContext.sessionId}/adapter-copilot`,
    'provider-proxy'
  )
  requestLoggerCache.set(cacheKey, logger)
  return logger
}

const parseRouteRequest = (rawUrl: string | undefined) => {
  const localUrl = new URL(rawUrl ?? '/', 'http://127.0.0.1')
  const parts = localUrl.pathname.split('/').filter(Boolean)
  if (parts[0] !== '__vf_provider' || parts[1] == null) return undefined

  return {
    routeId: parts[1],
    requestPath: `/${parts.slice(2).join('/')}`,
    searchParams: localUrl.searchParams,
    localPath: localUrl.pathname
  }
}

const toFetchBody = (body: Buffer | undefined): BodyInit | undefined => (
  body == null || body.length === 0 ? undefined : new Uint8Array(body)
)

const summarizeRequest = (req: IncomingMessage) => ({
  method: req.method,
  requestUrl: req.url,
  contentType: normalizeHeaderValue(req.headers['content-type']),
  hasAuthorizationHeader: normalizeHeaderValue(req.headers.authorization) != null
})

const serializeErrorBodyForLog = (text: string, contentType: string | null) => {
  if (contentType?.includes('json') === true) {
    try {
      return {
        format: 'json',
        json: JSON.parse(text) as unknown
      }
    } catch {
    }
  }

  return {
    format: 'text',
    text
  }
}

const handleProxyRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  logger: Logger | undefined
) => {
  const parsed = parseRouteRequest(req.url)
  if (parsed == null) {
    logger?.warn('[copilot provider proxy] invalid route', summarizeRequest(req))
    writeJsonError(res, 404, 'Invalid provider proxy route')
    return
  }

  const route = routes.get(parsed.routeId)
  const requestLogger = getRequestLogger(route?.logContext) ?? logger
  if (route == null) {
    requestLogger?.warn('[copilot provider proxy] unknown route', {
      ...summarizeRequest(req),
      routeId: parsed.routeId
    })
    writeJsonError(res, 404, 'Unknown provider proxy route')
    return
  }

  let requestBody: Buffer
  try {
    requestBody = await readRequestBody(req)
  } catch {
    writeJsonError(res, 400, 'Failed to read request body')
    return
  }

  const requestId = `copilot-provider-${++proxyRequestCounter}`
  const startedAt = Date.now()
  const upstreamUrl = buildUpstreamUrl(route, parsed.requestPath, parsed.searchParams)
  const upstreamHeaders = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    const normalizedKey = key.toLowerCase()
    const normalizedValue = normalizeHeaderValue(value)
    if (normalizedValue == null || REQUEST_HEADERS_TO_DROP.has(normalizedKey)) continue
    upstreamHeaders.set(key, normalizedValue)
  }
  for (const [key, value] of Object.entries(route.headers ?? {})) {
    upstreamHeaders.set(key, value)
  }

  requestLogger?.info('[copilot provider proxy] request received', {
    requestId,
    routeId: parsed.routeId,
    localPath: parsed.localPath,
    upstreamOrigin: upstreamUrl.origin,
    upstreamPath: upstreamUrl.pathname,
    diagnostics: route.diagnostics,
    incomingHeaders: sanitizeIncomingHeadersForLog(req.headers),
    requestBodyBytes: requestBody.byteLength
  })
  requestLogger?.info('[copilot provider proxy] forwarding request', {
    requestId,
    method: req.method,
    upstreamOrigin: upstreamUrl.origin,
    upstreamPath: upstreamUrl.pathname,
    upstreamHeaders: sanitizeHeaderEntriesForLog(upstreamHeaders.entries())
  })

  const abortController = new AbortController()
  const abortOnRequestAborted = () => abortController.abort()
  const abortOnResponseClosed = () => {
    if (!res.writableEnded) abortController.abort()
  }
  req.once('aborted', abortOnRequestAborted)
  res.once('close', abortOnResponseClosed)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method ?? 'POST',
      headers: upstreamHeaders,
      body: toFetchBody(requestBody),
      signal: abortController.signal
    })
    const responseHeaders = new Headers()
    upstreamResponse.headers.forEach((value, key) => {
      if (RESPONSE_HEADERS_TO_DROP.has(key.toLowerCase())) return
      responseHeaders.set(key, value)
    })
    requestLogger?.info('[copilot provider proxy] upstream response received', {
      requestId,
      upstreamOrigin: upstreamUrl.origin,
      upstreamPath: upstreamUrl.pathname,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      durationMs: Date.now() - startedAt,
      responseHeaders: sanitizeHeaderEntriesForLog(responseHeaders.entries())
    })
    const responseBodyForLogPromise = !upstreamResponse.ok && upstreamResponse.body != null
      ? upstreamResponse.clone().text()
        .then(text => serializeErrorBodyForLog(text, upstreamResponse.headers.get('content-type')))
        .catch(() => undefined)
      : Promise.resolve(undefined)
    res.writeHead(upstreamResponse.status, Object.fromEntries(responseHeaders.entries()))

    if (upstreamResponse.body == null) {
      const responseBodyForLog = await responseBodyForLogPromise
      const completedLog = {
        requestId,
        upstreamOrigin: upstreamUrl.origin,
        upstreamPath: upstreamUrl.pathname,
        status: upstreamResponse.status,
        durationMs: Date.now() - startedAt,
        responseBodyBytes: 0,
        ...(responseBodyForLog != null ? { responseBody: responseBodyForLog } : {})
      }
      if (upstreamResponse.ok) requestLogger?.info('[copilot provider proxy] request completed', completedLog)
      else requestLogger?.warn('[copilot provider proxy] upstream returned error status', completedLog)
      res.end()
      return
    }

    const responseStream = Readable.fromWeb(upstreamResponse.body as NodeReadableStream)
    let responseBodyBytes = 0
    responseStream.on('data', (chunk: unknown) => {
      if (chunk instanceof Uint8Array) {
        responseBodyBytes += chunk.byteLength
        return
      }
      responseBodyBytes += Buffer.byteLength(String(chunk))
    })
    await pipeline(responseStream, res)

    const responseBodyForLog = await responseBodyForLogPromise
    const completedLog = {
      requestId,
      upstreamOrigin: upstreamUrl.origin,
      upstreamPath: upstreamUrl.pathname,
      status: upstreamResponse.status,
      durationMs: Date.now() - startedAt,
      responseBodyBytes,
      ...(responseBodyForLog != null ? { responseBody: responseBodyForLog } : {})
    }
    if (upstreamResponse.ok) requestLogger?.info('[copilot provider proxy] request completed', completedLog)
    else requestLogger?.warn('[copilot provider proxy] upstream returned error status', completedLog)
  } catch (err) {
    if (abortController.signal.aborted) {
      res.end()
      return
    }
    requestLogger?.error('[copilot provider proxy] upstream request failed', {
      err,
      requestId,
      routeId: parsed.routeId,
      upstreamOrigin: upstreamUrl.origin,
      upstreamPath: upstreamUrl.pathname
    })
    writeJsonError(res, 502, err instanceof Error ? err.message : String(err))
  } finally {
    req.off('aborted', abortOnRequestAborted)
    res.off('close', abortOnResponseClosed)
  }
}

export const ensureCopilotProviderProxyServer = async (logger?: Logger) => {
  if (logger != null) {
    proxyServerLogger = logger
  }

  if (proxyServerPromise == null) {
    proxyServerPromise = new Promise((resolve, reject) => {
      proxyServerLogger?.info('[copilot provider proxy] starting local proxy server')
      const server = createServer((req, res) => {
        void handleProxyRequest(req, res, proxyServerLogger)
      })

      server.once('error', (err) => {
        proxyServerLogger?.error('[copilot provider proxy] local proxy server failed', { err })
        proxyServerPromise = undefined
        reject(err)
      })
      server.once('close', () => {
        proxyServerLogger?.info('[copilot provider proxy] local proxy server closed')
        proxyServerPromise = undefined
      })
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (address == null || typeof address === 'string') {
          server.close()
          reject(new Error('Failed to resolve local Copilot provider proxy address'))
          return
        }
        server.unref()
        const baseUrl = `http://127.0.0.1:${address.port}`
        proxyServerLogger?.info('[copilot provider proxy] local proxy server ready', { baseUrl })
        resolve({ baseUrl })
      })
    })
  }

  return proxyServerPromise
}

export const registerCopilotProviderProxyRoute = async (
  route: CopilotProviderProxyRoute,
  logger?: Logger
) => {
  const server = await ensureCopilotProviderProxyServer(logger)
  const routeId = `route-${++proxyRouteCounter}`
  routes.set(routeId, route)
  return {
    routeId,
    baseUrl: `${server.baseUrl}/__vf_provider/${routeId}`
  }
}
