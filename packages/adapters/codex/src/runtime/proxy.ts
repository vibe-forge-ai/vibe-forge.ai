import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

import { createLogger } from '@vibe-forge/utils/create-logger'
import type { Logger } from '@vibe-forge/utils/create-logger'

import type { CodexProxyCatalog } from './proxy-catalog'

export const CODEX_PROXY_META_HEADER_NAME = 'X-Vibe-Forge-Proxy-Meta'
export const CODEX_PROXY_SESSION_HEADER_NAME = 'X-Vibe-Forge-Proxy-Session'
type CodexProxyLogger = Logger

interface CodexProxyLogContext {
  cwd: string
  ctxId: string
  sessionId: string
}

export interface CodexProxyDiagnostics {
  routedServiceKey?: string
  requestedModel?: string
  resolvedModel?: string
  runtime?: string
  sessionType?: string
  permissionMode?: string
  approvalPolicy?: string
  sandboxPolicy?: string
  useYolo?: boolean
  requestedEffort?: string
  effectiveEffort?: string
  wireApi?: string
}

export interface CodexProxyMeta {
  upstreamBaseUrl: string
  queryParams?: Record<string, string>
  headers?: Record<string, string>
  maxOutputTokens?: number
  logContext?: CodexProxyLogContext
  diagnostics?: CodexProxyDiagnostics
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

let proxyServerPromise: Promise<{ baseUrl: string }> | undefined
let proxyServerLogger: CodexProxyLogger | undefined
const requestLoggerCache = new Map<string, CodexProxyLogger>()
let proxyRequestCounter = 0

const REDACTED_VALUE = '[REDACTED]'
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
  /password$/i,
  /signature$/i
]

export const encodeCodexProxyMeta = (meta: CodexProxyMeta) =>
  Buffer.from(JSON.stringify(meta), 'utf8').toString('base64url')

const decodeCodexProxyMeta = (rawValue: string): CodexProxyMeta => {
  const decoded = Buffer.from(rawValue, 'base64url').toString('utf8')
  return JSON.parse(decoded) as CodexProxyMeta
}

const readRequestBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const normalizeContentType = (value: string | string[] | undefined) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value
  return normalizedValue?.split(';', 1)[0]?.trim().toLowerCase()
}

const looksLikeJsonPayload = (buffer: Buffer) => {
  const text = buffer.toString('utf8').trimStart()
  return text.startsWith('{') || text.startsWith('[')
}

interface PreparedUpstreamBody {
  body: string | Buffer | undefined
  injectedMaxOutputTokens?: number
}

const maybeInjectMaxOutputTokens = (
  requestBodyBuffer: Buffer,
  req: IncomingMessage,
  proxyMeta: CodexProxyMeta
): PreparedUpstreamBody => {
  if (requestBodyBuffer.length === 0) {
    return { body: undefined }
  }

  const normalizedMaxOutputTokens = (
      typeof proxyMeta.maxOutputTokens === 'number' &&
      Number.isFinite(proxyMeta.maxOutputTokens) &&
      proxyMeta.maxOutputTokens > 0
    )
    ? Math.floor(proxyMeta.maxOutputTokens)
    : undefined

  if (normalizedMaxOutputTokens == null) {
    return { body: requestBodyBuffer }
  }

  const contentType = normalizeContentType(req.headers['content-type'])
  const shouldInspectJson = contentType === 'application/json' ||
    contentType?.endsWith('+json') === true ||
    looksLikeJsonPayload(requestBodyBuffer)

  if (!shouldInspectJson) {
    return { body: requestBodyBuffer }
  }

  const requestBodyText = requestBodyBuffer.toString('utf8')

  try {
    const parsedBody = JSON.parse(requestBodyText) as unknown
    if (!isPlainObject(parsedBody) || parsedBody.max_output_tokens != null) {
      return { body: requestBodyText }
    }
    parsedBody.max_output_tokens = normalizedMaxOutputTokens
    return {
      body: JSON.stringify(parsedBody),
      injectedMaxOutputTokens: normalizedMaxOutputTokens
    }
  } catch {
    return { body: requestBodyText }
  }
}

const toFetchBody = (body: string | Buffer | undefined): BodyInit | undefined => {
  if (body == null) return undefined
  if (typeof body === 'string') return body
  return new Uint8Array(body)
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

const buildUpstreamUrl = (
  upstreamBaseUrl: string,
  requestUrl: string,
  queryParams: Record<string, string>
) => {
  const normalizedBaseUrl = upstreamBaseUrl.endsWith('/')
    ? upstreamBaseUrl.slice(0, -1)
    : upstreamBaseUrl
  const upstreamUrl = new URL(`${normalizedBaseUrl}${requestUrl}`)
  for (const [key, value] of Object.entries(queryParams)) {
    upstreamUrl.searchParams.set(key, value)
  }
  return upstreamUrl
}

const normalizeHeaderValue = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value.join(', ') : value
)

const isSensitiveLogKey = (key: string) => (
  SENSITIVE_LOG_KEY_PATTERNS.some(pattern => pattern.test(key))
)

const sanitizeForLog = (value: unknown, keyHint?: string): unknown => {
  if (keyHint != null && isSensitiveLogKey(keyHint)) {
    return REDACTED_VALUE
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForLog(item))
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeForLog(item, key)])
    )
  }
  return value
}

const sanitizeHeaderEntriesForLog = (
  entries: Iterable<[string, string]>
) =>
  Object.fromEntries(
    Array.from(entries, ([key, value]) => [key, isSensitiveLogKey(key) ? REDACTED_VALUE : value])
  )

const sanitizeIncomingHeadersForLog = (
  headers: IncomingMessage['headers'],
  excludedKeys: ReadonlySet<string> = new Set()
) =>
  Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key, normalizeHeaderValue(value)] as const)
      .filter((entry): entry is [string, string] => entry[1] != null)
      .filter(([key]) => !excludedKeys.has(key.toLowerCase()))
      .map(([key, value]) => [key, isSensitiveLogKey(key) ? REDACTED_VALUE : value] as const)
  )

const appendRecordValue = (
  record: Record<string, string | string[]>,
  key: string,
  value: string
) => {
  const current = record[key]
  if (current == null) {
    record[key] = value
    return
  }
  if (Array.isArray(current)) {
    current.push(value)
    return
  }
  record[key] = [current, value]
}

const sanitizeSearchParamsForLog = (searchParams: URLSearchParams) => {
  const record: Record<string, string | string[]> = {}
  for (const [key, value] of searchParams.entries()) {
    appendRecordValue(
      record,
      key,
      isSensitiveLogKey(key) ? REDACTED_VALUE : value
    )
  }
  return record
}

const sanitizeStringRecordForLog = (record: Record<string, string>) => (
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, isSensitiveLogKey(key) ? REDACTED_VALUE : value])
  )
)

const toBodyBuffer = (body: string | Buffer | undefined) => {
  if (body == null) return undefined
  if (typeof body === 'string') return Buffer.from(body)
  return body
}

const isTextualContentType = (contentType: string | undefined) => (
  contentType == null ||
  contentType.startsWith('text/') ||
  contentType === 'application/x-www-form-urlencoded' ||
  contentType === 'application/xml' ||
  contentType === 'application/graphql' ||
  contentType === 'application/javascript' ||
  contentType === 'application/x-ndjson' ||
  contentType === 'application/json' ||
  contentType?.endsWith('+json') === true ||
  contentType?.endsWith('+xml') === true
)

interface SerializedBodyForLog {
  byteLength: number
  format: 'empty' | 'json' | 'form' | 'text' | 'binary'
  json?: unknown
  form?: Record<string, string | string[]>
  text?: string
  base64?: string
}

const serializeBodyForLog = (
  body: string | Buffer | undefined,
  contentType: string | undefined
): SerializedBodyForLog => {
  const buffer = toBodyBuffer(body)
  if (buffer == null || buffer.length === 0) {
    return {
      byteLength: 0,
      format: 'empty'
    }
  }

  const bodyText = buffer.toString('utf8')
  const shouldTreatAsJson = contentType === 'application/json' ||
    contentType?.endsWith('+json') === true ||
    looksLikeJsonPayload(buffer)

  if (shouldTreatAsJson) {
    try {
      return {
        byteLength: buffer.length,
        format: 'json',
        json: sanitizeForLog(JSON.parse(bodyText) as unknown)
      }
    } catch {
      return {
        byteLength: buffer.length,
        format: 'text',
        text: bodyText
      }
    }
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    return {
      byteLength: buffer.length,
      format: 'form',
      form: sanitizeSearchParamsForLog(new URLSearchParams(bodyText))
    }
  }

  if (isTextualContentType(contentType)) {
    return {
      byteLength: buffer.length,
      format: 'text',
      text: bodyText
    }
  }

  return {
    byteLength: buffer.length,
    format: 'binary',
    base64: buffer.toString('base64')
  }
}

const summarizeProxyMeta = (proxyMeta: CodexProxyMeta) => ({
  upstreamBaseUrl: proxyMeta.upstreamBaseUrl,
  queryParamKeys: Object.keys(proxyMeta.queryParams ?? {}),
  headerKeys: Object.keys(proxyMeta.headers ?? {}),
  hasMaxOutputTokens: typeof proxyMeta.maxOutputTokens === 'number'
})

const summarizeRequest = (req: IncomingMessage) => ({
  method: req.method,
  requestUrl: req.url,
  contentType: normalizeContentType(req.headers['content-type']),
  hasAuthorizationHeader: normalizeHeaderValue(req.headers.authorization) != null
})

const summarizeUpstreamUrl = (upstreamUrl: URL) => ({
  upstreamOrigin: upstreamUrl.origin,
  upstreamPath: upstreamUrl.pathname,
  upstreamQueryParams: sanitizeSearchParamsForLog(upstreamUrl.searchParams)
})

const summarizeLocalUrl = (requestUrl: string) => {
  const localUrl = new URL(requestUrl, 'http://127.0.0.1')
  return {
    requestPath: localUrl.pathname,
    requestQueryParams: sanitizeSearchParamsForLog(localUrl.searchParams)
  }
}

const summarizeProxyMetaForLog = (proxyMeta: CodexProxyMeta) => ({
  upstreamBaseUrl: proxyMeta.upstreamBaseUrl,
  queryParams: sanitizeStringRecordForLog(proxyMeta.queryParams ?? {}),
  headers: sanitizeStringRecordForLog(proxyMeta.headers ?? {}),
  maxOutputTokens: proxyMeta.maxOutputTokens,
  diagnostics: sanitizeForLog(proxyMeta.diagnostics),
  logContext: proxyMeta.logContext
})

const getErrorCause = (err: unknown) => (
  err instanceof Error && 'cause' in err ? err.cause : undefined
)

const getRequestLogger = (logContext: CodexProxyLogContext | undefined) => {
  if (logContext == null) return undefined
  const cacheKey = `${logContext.cwd}\n${logContext.ctxId}\n${logContext.sessionId}`
  const cached = requestLoggerCache.get(cacheKey)
  if (cached != null) return cached
  const logger = createLogger(
    logContext.cwd,
    `${logContext.ctxId}/${logContext.sessionId}/adapter-codex`,
    'proxy'
  )
  requestLoggerCache.set(cacheKey, logger)
  return logger
}

const extractModelFromBody = (body: Buffer): string | undefined => {
  if (body.length === 0) return undefined
  try {
    const parsed = JSON.parse(body.toString('utf8')) as unknown
    if (isPlainObject(parsed) && typeof parsed.model === 'string') {
      return parsed.model
    }
  } catch {}
  return undefined
}

interface ResolvedProxyContext {
  proxyMeta: CodexProxyMeta
  requestBodyBuffer: Buffer
}

const resolveProxyContext = async (
  req: IncomingMessage,
  logger: CodexProxyLogger | undefined
): Promise<ResolvedProxyContext | { error: { status: number; message: string } }> => {
  const rawMetaHeader = normalizeHeaderValue(req.headers[CODEX_PROXY_META_HEADER_NAME.toLowerCase()])

  if (typeof rawMetaHeader === 'string' && rawMetaHeader.trim() !== '') {
    let proxyMeta: CodexProxyMeta
    try {
      proxyMeta = decodeCodexProxyMeta(rawMetaHeader)
    } catch {
      return { error: { status: 400, message: `Invalid ${CODEX_PROXY_META_HEADER_NAME} header` } }
    }
    let requestBodyBuffer: Buffer
    try {
      requestBodyBuffer = await readRequestBody(req)
    } catch {
      return { error: { status: 400, message: 'Failed to read request body' } }
    }
    return { proxyMeta, requestBodyBuffer }
  }

  const sessionKey = normalizeHeaderValue(req.headers[CODEX_PROXY_SESSION_HEADER_NAME.toLowerCase()])
  if (typeof sessionKey === 'string' && sessionKey.trim() !== '') {
    const catalog = getProxyCatalog(sessionKey)
    if (catalog == null) {
      return { error: { status: 400, message: `No proxy catalog registered for session: ${sessionKey}` } }
    }
    let requestBodyBuffer: Buffer
    try {
      requestBodyBuffer = await readRequestBody(req)
    } catch {
      return { error: { status: 400, message: 'Failed to read request body' } }
    }
    const modelId = extractModelFromBody(requestBodyBuffer)
    if (modelId == null) {
      return { error: { status: 400, message: 'Could not extract model from request body' } }
    }
    const route = catalog.resolve(modelId)
    if (route == null) {
      return { error: { status: 400, message: `No route found for model: ${modelId}` } }
    }
    catalog.setCurrentModel(modelId)
    const slashIdx = sessionKey.indexOf('/')
    const logContext: CodexProxyLogContext | undefined = slashIdx > 0
      ? {
        cwd: '',
        ctxId: sessionKey.slice(0, slashIdx),
        sessionId: sessionKey.slice(slashIdx + 1)
      }
      : undefined
    const proxyMeta: CodexProxyMeta = {
      upstreamBaseUrl: route.upstreamBaseUrl,
      ...(route.headers != null && Object.keys(route.headers).length > 0 ? { headers: route.headers } : {}),
      ...(route.queryParams != null && Object.keys(route.queryParams).length > 0
        ? { queryParams: route.queryParams }
        : {}),
      ...(route.maxOutputTokens != null ? { maxOutputTokens: route.maxOutputTokens } : {}),
      ...(logContext != null ? { logContext } : {})
    }
    return { proxyMeta, requestBodyBuffer }
  }

  return {
    error: {
      status: 400,
      message: `Missing required ${CODEX_PROXY_META_HEADER_NAME} or ${CODEX_PROXY_SESSION_HEADER_NAME} header`
    }
  }
}

const handleProxyRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  logger: CodexProxyLogger | undefined
) => {
  const resolved = await resolveProxyContext(req, logger)
  if ('error' in resolved) {
    logger?.warn('[codex proxy] proxy context resolution failed', {
      ...summarizeRequest(req),
      errorMessage: resolved.error.message
    })
    writeJsonError(res, resolved.error.status, resolved.error.message)
    return
  }
  const { proxyMeta, requestBodyBuffer } = resolved
  const requestLogger = getRequestLogger(proxyMeta.logContext) ?? logger

  if (typeof proxyMeta.upstreamBaseUrl !== 'string' || proxyMeta.upstreamBaseUrl.trim() === '') {
    requestLogger?.warn('[codex proxy] invalid proxy metadata', {
      ...summarizeRequest(req),
      ...summarizeProxyMeta(proxyMeta)
    })
    writeJsonError(res, 400, 'Invalid proxy metadata: upstreamBaseUrl is required')
    return
  }

  const requestId = `proxy-${++proxyRequestCounter}`
  const requestStartedAt = Date.now()
  const requestUrl = req.url ?? '/responses'
  const requestContentType = normalizeContentType(req.headers['content-type'])
  const preparedUpstreamBody = maybeInjectMaxOutputTokens(requestBodyBuffer, req, proxyMeta)
  const upstreamBody = preparedUpstreamBody.body

  const upstreamHeaders = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    const normalizedKey = key.toLowerCase()
    const normalizedValue = normalizeHeaderValue(value)
    if (normalizedValue == null) continue
    if (REQUEST_HEADERS_TO_DROP.has(normalizedKey)) continue
    if (normalizedKey === CODEX_PROXY_META_HEADER_NAME.toLowerCase()) continue
    if (normalizedKey === CODEX_PROXY_SESSION_HEADER_NAME.toLowerCase()) continue
    upstreamHeaders.set(key, normalizedValue)
  }
  for (const [key, value] of Object.entries(proxyMeta.headers ?? {})) {
    upstreamHeaders.set(key, value)
  }

  const upstreamUrl = buildUpstreamUrl(
    proxyMeta.upstreamBaseUrl,
    requestUrl,
    proxyMeta.queryParams ?? {}
  )
  requestLogger?.info('[codex proxy] request received', {
    requestId,
    ...summarizeRequest(req),
    ...summarizeLocalUrl(requestUrl),
    proxyMeta: summarizeProxyMetaForLog(proxyMeta),
    incomingHeaders: sanitizeIncomingHeadersForLog(
      req.headers,
      new Set([CODEX_PROXY_META_HEADER_NAME.toLowerCase()])
    ),
    incomingBody: serializeBodyForLog(requestBodyBuffer, requestContentType)
  })
  requestLogger?.info('[codex proxy] forwarding request', {
    requestId,
    ...summarizeRequest(req),
    ...summarizeLocalUrl(requestUrl),
    ...summarizeUpstreamUrl(upstreamUrl),
    upstreamHeaders: sanitizeHeaderEntriesForLog(upstreamHeaders.entries()),
    upstreamBody: serializeBodyForLog(upstreamBody, requestContentType),
    proxyMutations: {
      requestBodyChanged: !Buffer.from(requestBodyBuffer).equals(toBodyBuffer(upstreamBody) ?? Buffer.alloc(0)),
      injectedMaxOutputTokens: preparedUpstreamBody.injectedMaxOutputTokens ?? null
    }
  })
  const abortController = new AbortController()
  const abortRequest = () => abortController.abort()
  const abortOnRequestAborted = () => abortRequest()
  const abortOnResponseClosed = () => {
    if (!res.writableEnded) {
      requestLogger?.warn('[codex proxy] downstream connection closed before response completed', {
        ...summarizeRequest(req),
        ...summarizeProxyMeta(proxyMeta),
        ...summarizeUpstreamUrl(upstreamUrl)
      })
      abortRequest()
    }
  }
  req.once('aborted', abortOnRequestAborted)
  res.once('close', abortOnResponseClosed)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method ?? 'POST',
      headers: upstreamHeaders,
      body: toFetchBody(upstreamBody),
      signal: abortController.signal
    })
    const responseContentType = normalizeContentType(upstreamResponse.headers.get('content-type') ?? undefined)
    const shouldCaptureResponseBody = upstreamResponse.status >= 400 && responseContentType !== 'text/event-stream'
    const responseBodyForLogPromise = shouldCaptureResponseBody
      ? upstreamResponse.clone().text()
        .then(text => serializeBodyForLog(text, responseContentType))
        .catch(() => undefined)
      : Promise.resolve(undefined)

    const responseHeaders = new Headers()
    upstreamResponse.headers.forEach((value, key) => {
      if (RESPONSE_HEADERS_TO_DROP.has(key.toLowerCase())) return
      responseHeaders.set(key, value)
    })
    requestLogger?.info('[codex proxy] upstream response received', {
      requestId,
      ...summarizeUpstreamUrl(upstreamUrl),
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      durationMs: Date.now() - requestStartedAt,
      responseHeaders: sanitizeHeaderEntriesForLog(responseHeaders.entries())
    })
    res.writeHead(upstreamResponse.status, Object.fromEntries(responseHeaders.entries()))

    if (upstreamResponse.body == null) {
      const responseBodyForLog = await responseBodyForLogPromise
      const completedLog = {
        requestId,
        ...summarizeUpstreamUrl(upstreamUrl),
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        durationMs: Date.now() - requestStartedAt,
        responseBodyBytes: 0,
        ...(responseBodyForLog != null ? { responseBody: responseBodyForLog } : {})
      }
      if (upstreamResponse.ok) {
        requestLogger?.info('[codex proxy] request completed', completedLog)
      } else {
        requestLogger?.warn('[codex proxy] upstream returned error status', completedLog)
      }
      res.end()
      return
    }

    const responseStream = Readable.fromWeb(upstreamResponse.body as NodeReadableStream)
    let responseBodyBytes = 0
    responseStream.on('data', (chunk: unknown) => {
      if (typeof chunk === 'string') {
        responseBodyBytes += Buffer.byteLength(chunk)
        return
      }
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
      ...summarizeUpstreamUrl(upstreamUrl),
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      durationMs: Date.now() - requestStartedAt,
      responseBodyBytes,
      ...(responseBodyForLog != null ? { responseBody: responseBodyForLog } : {})
    }
    if (upstreamResponse.ok) {
      requestLogger?.info('[codex proxy] request completed', completedLog)
    } else {
      requestLogger?.warn('[codex proxy] upstream returned error status', completedLog)
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      res.end()
      return
    }
    requestLogger?.error('[codex proxy] upstream request failed', {
      err,
      cause: getErrorCause(err),
      requestId,
      ...summarizeRequest(req),
      ...summarizeProxyMeta(proxyMeta),
      ...summarizeUpstreamUrl(upstreamUrl)
    })
    writeJsonError(
      res,
      502,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    req.off('aborted', abortOnRequestAborted)
    res.off('close', abortOnResponseClosed)
  }
}

export const ensureCodexProxyServer = async (logger?: CodexProxyLogger) => {
  if (logger != null) {
    proxyServerLogger = logger
  }

  if (proxyServerPromise == null) {
    proxyServerPromise = new Promise((resolve, reject) => {
      proxyServerLogger?.info('[codex proxy] starting local proxy server')
      const server = createServer((req, res) => {
        void handleProxyRequest(req, res, proxyServerLogger)
      })

      server.once('error', (err) => {
        proxyServerLogger?.error('[codex proxy] local proxy server failed', { err })
        proxyServerPromise = undefined
        reject(err)
      })

      server.once('close', () => {
        proxyServerLogger?.info('[codex proxy] local proxy server closed')
        proxyServerPromise = undefined
      })

      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (address == null || typeof address === 'string') {
          server.close()
          reject(new Error('Failed to resolve local Codex proxy address'))
          return
        }
        server.unref()
        proxyServerLogger?.info('[codex proxy] local proxy server ready', {
          baseUrl: `http://127.0.0.1:${address.port}`
        })
        resolve({
          baseUrl: `http://127.0.0.1:${address.port}`
        })
      })
    })
  }

  return proxyServerPromise
}

const proxyCatalogs = new Map<string, CodexProxyCatalog>()

export function registerProxyCatalog(sessionKey: string, catalog: CodexProxyCatalog): void {
  proxyCatalogs.set(sessionKey, catalog)
}

export function unregisterProxyCatalog(sessionKey: string): void {
  proxyCatalogs.delete(sessionKey)
}

export function getProxyCatalog(sessionKey: string): CodexProxyCatalog | undefined {
  return proxyCatalogs.get(sessionKey)
}
