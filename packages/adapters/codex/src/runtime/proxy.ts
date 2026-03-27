import { createLogger } from '@vibe-forge/core/utils/create-logger'
import type { Logger } from '@vibe-forge/core/utils/create-logger'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

export const CODEX_PROXY_META_HEADER_NAME = 'X-Vibe-Forge-Proxy-Meta'
type CodexProxyLogger = Logger

interface CodexProxyLogContext {
  cwd: string
  ctxId: string
  sessionId: string
}

export interface CodexProxyMeta {
  upstreamBaseUrl: string
  queryParams?: Record<string, string>
  headers?: Record<string, string>
  maxOutputTokens?: number
  logContext?: CodexProxyLogContext
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

const maybeInjectMaxOutputTokens = (
  requestBodyBuffer: Buffer,
  req: IncomingMessage,
  proxyMeta: CodexProxyMeta
): string | Buffer | undefined => {
  if (requestBodyBuffer.length === 0) return undefined

  const normalizedMaxOutputTokens = (
      typeof proxyMeta.maxOutputTokens === 'number' &&
      Number.isFinite(proxyMeta.maxOutputTokens) &&
      proxyMeta.maxOutputTokens > 0
    )
    ? Math.floor(proxyMeta.maxOutputTokens)
    : undefined

  if (normalizedMaxOutputTokens == null) return requestBodyBuffer

  const contentType = normalizeContentType(req.headers['content-type'])
  const shouldInspectJson = contentType === 'application/json' ||
    contentType?.endsWith('+json') === true ||
    looksLikeJsonPayload(requestBodyBuffer)

  if (!shouldInspectJson) return requestBodyBuffer

  const requestBodyText = requestBodyBuffer.toString('utf8')

  try {
    const parsedBody = JSON.parse(requestBodyText) as unknown
    if (!isPlainObject(parsedBody) || parsedBody.max_output_tokens != null) {
      return requestBodyText
    }
    parsedBody.max_output_tokens = normalizedMaxOutputTokens
    return JSON.stringify(parsedBody)
  } catch {
    return requestBodyText
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
  queryParamKeys: Array.from(new Set(upstreamUrl.searchParams.keys()))
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

const handleProxyRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  logger: CodexProxyLogger | undefined
) => {
  const rawMetaHeader = normalizeHeaderValue(req.headers[CODEX_PROXY_META_HEADER_NAME.toLowerCase()])
  if (typeof rawMetaHeader !== 'string' || rawMetaHeader.trim() === '') {
    logger?.warn('[codex proxy] missing proxy metadata header', summarizeRequest(req))
    writeJsonError(res, 400, `Missing required ${CODEX_PROXY_META_HEADER_NAME} header`)
    return
  }

  let proxyMeta: CodexProxyMeta
  try {
    proxyMeta = decodeCodexProxyMeta(rawMetaHeader)
  } catch {
    logger?.warn('[codex proxy] invalid proxy metadata header', summarizeRequest(req))
    writeJsonError(res, 400, `Invalid ${CODEX_PROXY_META_HEADER_NAME} header`)
    return
  }
  const requestLogger = getRequestLogger(proxyMeta.logContext) ?? logger

  if (typeof proxyMeta.upstreamBaseUrl !== 'string' || proxyMeta.upstreamBaseUrl.trim() === '') {
    requestLogger?.warn('[codex proxy] invalid proxy metadata', {
      ...summarizeRequest(req),
      ...summarizeProxyMeta(proxyMeta)
    })
    writeJsonError(res, 400, 'Invalid proxy metadata: upstreamBaseUrl is required')
    return
  }

  let requestBodyBuffer: Buffer
  try {
    requestBodyBuffer = await readRequestBody(req)
  } catch {
    writeJsonError(res, 400, 'Failed to read request body')
    return
  }
  const upstreamBody = maybeInjectMaxOutputTokens(requestBodyBuffer, req, proxyMeta)

  const upstreamHeaders = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    const normalizedKey = key.toLowerCase()
    const normalizedValue = normalizeHeaderValue(value)
    if (normalizedValue == null) continue
    if (REQUEST_HEADERS_TO_DROP.has(normalizedKey)) continue
    if (normalizedKey === CODEX_PROXY_META_HEADER_NAME.toLowerCase()) continue
    upstreamHeaders.set(key, normalizedValue)
  }
  for (const [key, value] of Object.entries(proxyMeta.headers ?? {})) {
    upstreamHeaders.set(key, value)
  }

  const requestUrl = req.url ?? '/responses'
  const upstreamUrl = buildUpstreamUrl(
    proxyMeta.upstreamBaseUrl,
    requestUrl,
    proxyMeta.queryParams ?? {}
  )
  requestLogger?.debug('[codex proxy] forwarding request', {
    ...summarizeRequest(req),
    ...summarizeProxyMeta(proxyMeta),
    ...summarizeUpstreamUrl(upstreamUrl)
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
    if (!upstreamResponse.ok) {
      requestLogger?.warn('[codex proxy] upstream returned error status', {
        ...summarizeRequest(req),
        ...summarizeProxyMeta(proxyMeta),
        ...summarizeUpstreamUrl(upstreamUrl),
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText
      })
    }

    const responseHeaders = new Headers()
    upstreamResponse.headers.forEach((value, key) => {
      if (RESPONSE_HEADERS_TO_DROP.has(key.toLowerCase())) return
      responseHeaders.set(key, value)
    })
    res.writeHead(upstreamResponse.status, Object.fromEntries(responseHeaders.entries()))

    if (upstreamResponse.body == null) {
      res.end()
      return
    }

    Readable.fromWeb(upstreamResponse.body as NodeReadableStream).pipe(res)
  } catch (err) {
    if (abortController.signal.aborted) {
      res.end()
      return
    }
    requestLogger?.error('[codex proxy] upstream request failed', {
      err,
      cause: getErrorCause(err),
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
