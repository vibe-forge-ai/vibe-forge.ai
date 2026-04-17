import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ModelServiceConfig } from '@vibe-forge/types'

interface GeminiFunctionDeclaration {
  name?: string
  description?: string
  parameters?: unknown
}

interface GeminiToolDeclaration {
  functionDeclarations?: GeminiFunctionDeclaration[]
}

interface GeminiFunctionCallPart {
  functionCall?: {
    name?: string
    args?: unknown
  }
}

interface GeminiFunctionResponsePart {
  functionResponse?: {
    name?: string
    response?: unknown
  }
}

interface GeminiTextPart {
  text?: string
}

type GeminiPart = GeminiFunctionCallPart | GeminiFunctionResponsePart | GeminiTextPart | Record<string, unknown>

interface GeminiContent {
  role?: string
  parts?: GeminiPart[]
}

interface GeminiGenerateContentRequest {
  contents?: GeminiContent[]
  generationConfig?: {
    thinkingConfig?: Record<string, unknown>
  }
  systemInstruction?: {
    parts?: GeminiPart[]
  }
  tools?: GeminiToolDeclaration[]
}

interface OpenAiTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

interface OpenAiChatCompletionRequest {
  model: string
  stream: false
  messages: OpenAiMessage[]
  max_tokens?: number
  thinking?: {
    type: 'disabled'
  }
  tools?: OpenAiTool[]
}

interface OpenAiChatCompletionChoice {
  finish_reason?: string | null
  message?: {
    content?: string | Array<Record<string, unknown>> | null
    tool_calls?: Array<{
      id?: string
      type?: string
      function?: {
        name?: string
        arguments?: string
      }
    }>
  }
}

type OpenAiMessageContent = string | Array<Record<string, unknown>> | null | undefined

interface OpenAiChatCompletionResponse {
  choices?: OpenAiChatCompletionChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
    type?: string
    code?: string | number
  }
}

export interface GeminiProxyRouteConfig {
  apiKey: string
  disableThinking?: boolean
  endpoint: string
  headers?: Record<string, string>
  maxOutputTokens?: number
  model: string
  queryParams?: Record<string, string>
  serviceKey: string
  timeoutMs?: number
}

const REQUEST_PATH_RE =
  /^\/(?<routeKey>[^/]+)\/v1beta\/models\/[^/:]+:(?<method>generateContent|streamGenerateContent)$/u

const asPlainObject = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const normalizeStringRecord = (value: unknown): Record<string, string> => (
  Object.fromEntries(
    Object.entries(asPlainObject(value)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
)

const readRequestBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const writeJson = (res: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...headers
  })
  res.end(`${JSON.stringify(body)}\n`)
}

const writeGeminiError = (
  res: ServerResponse,
  statusCode: number,
  message: string,
  details?: unknown
) => {
  writeJson(res, statusCode, {
    error: {
      code: statusCode,
      status: 'UPSTREAM_ERROR',
      message,
      ...(details === undefined ? {} : { details })
    }
  })
}

const normalizeServiceEndpoint = (apiBaseUrl: string) => {
  const url = new URL(apiBaseUrl)
  if (/\/responses\/?$/u.test(url.pathname)) {
    throw new Error(
      `Gemini adapter external model routing expects an OpenAI-compatible chat/completions endpoint, got "${apiBaseUrl}".`
    )
  }
  if (!/\/chat\/completions\/?$/u.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(/\/$/u, '')}/chat/completions`
  }
  return url.toString()
}

const normalizePositiveInteger = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined
)

const normalizeGeminiServiceExtra = (service: ModelServiceConfig) => {
  const extra = asPlainObject(service.extra)
  return {
    ...normalizeStringRecord(asPlainObject(extra.codex).headers),
    ...normalizeStringRecord(asPlainObject(extra.claudeCodeRouter).headers),
    ...normalizeStringRecord(asPlainObject(extra.gemini).headers)
  }
}

const normalizeGeminiServiceQueryParams = (service: ModelServiceConfig) => {
  const extra = asPlainObject(service.extra)
  return {
    ...normalizeStringRecord(asPlainObject(extra.codex).queryParams),
    ...normalizeStringRecord(asPlainObject(extra.claudeCodeRouter).queryParams),
    ...normalizeStringRecord(asPlainObject(extra.gemini).queryParams)
  }
}

const getGeminiPartText = (part: GeminiPart) => (
  typeof (part as { text?: unknown }).text === 'string'
    ? (part as { text: string }).text
    : undefined
)

const getGeminiFunctionCall = (part: GeminiPart) => {
  const functionCall = (part as { functionCall?: unknown }).functionCall
  return functionCall != null && typeof functionCall === 'object' && !Array.isArray(functionCall)
    ? functionCall as NonNullable<GeminiFunctionCallPart['functionCall']>
    : undefined
}

const getGeminiFunctionResponse = (part: GeminiPart) => {
  const functionResponse = (part as { functionResponse?: unknown }).functionResponse
  return functionResponse != null && typeof functionResponse === 'object' && !Array.isArray(functionResponse)
    ? functionResponse as NonNullable<GeminiFunctionResponsePart['functionResponse']>
    : undefined
}

const extractTextParts = (parts: GeminiPart[] | undefined) => (
  (parts ?? [])
    .map(getGeminiPartText)
    .filter((part): part is string => part != null && part !== '')
)

const stringifyToolResult = (value: unknown) => {
  if (typeof value === 'string') return value
  return JSON.stringify(value ?? null)
}

const normalizeOpenAiSchemaType = (value: unknown) => (
  typeof value === 'string' ? value.toLowerCase() : value
)

export const sanitizeGeminiSchemaForOpenAi = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeGeminiSchemaForOpenAi(item))
  }

  if (value == null || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(record)) {
    if (key === '$schema' || key === 'propertyOrdering') continue
    if (key === 'nullable') continue
    if (key === 'format' && typeof item === 'string' && item !== 'date-time') continue
    if (key === 'type' && Array.isArray(item)) {
      sanitized.anyOf = item.map(type => ({ type: normalizeOpenAiSchemaType(type) }))
      continue
    }
    if (key === 'type') {
      sanitized.type = normalizeOpenAiSchemaType(item)
      continue
    }
    sanitized[key] = sanitizeGeminiSchemaForOpenAi(item)
  }

  return sanitized
}

export const convertGeminiRequestToOpenAiRequest = (params: {
  disableThinking?: boolean
  maxOutputTokens?: number
  model: string
  request: GeminiGenerateContentRequest
}): OpenAiChatCompletionRequest => {
  const { disableThinking, model, request, maxOutputTokens } = params
  const messages: OpenAiMessage[] = []
  const toolIdQueue: Array<{ id: string; name: string }> = []

  const systemText = extractTextParts(request.systemInstruction?.parts).join('\n\n')
  if (systemText !== '') {
    messages.push({
      role: 'system',
      content: systemText
    })
  }

  for (const content of request.contents ?? []) {
    const parts = content.parts ?? []
    const text = extractTextParts(parts).join('\n\n')
    const functionCalls = parts
      .map(getGeminiFunctionCall)
      .filter((part): part is NonNullable<GeminiFunctionCallPart['functionCall']> => part != null)
    const functionResponses = parts
      .map(getGeminiFunctionResponse)
      .filter((part): part is NonNullable<GeminiFunctionResponsePart['functionResponse']> => part != null)

    if (content.role === 'model') {
      const toolCalls = functionCalls.map((call) => {
        const id = `call_${randomUUID().replace(/-/gu, '')}`
        toolIdQueue.push({
          id,
          name: call.name?.trim() || 'unknown_tool'
        })
        return {
          id,
          type: 'function' as const,
          function: {
            name: call.name?.trim() || 'unknown_tool',
            arguments: JSON.stringify(asPlainObject(call.args))
          }
        }
      })

      if (text !== '' || toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: text === '' ? null : text,
          ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls })
        })
      }
      continue
    }

    if (text !== '') {
      messages.push({
        role: 'user',
        content: text
      })
    }

    for (const response of functionResponses) {
      const pendingIndex = toolIdQueue.findIndex(entry => entry.name === response.name)
      const pending = pendingIndex >= 0
        ? toolIdQueue.splice(pendingIndex, 1)[0]
        : { id: `call_${randomUUID().replace(/-/gu, '')}`, name: response.name ?? 'unknown_tool' }

      messages.push({
        role: 'tool',
        tool_call_id: pending.id,
        content: stringifyToolResult(response.response)
      })
    }
  }

  const tools = (request.tools ?? [])
    .flatMap(item => item.functionDeclarations ?? [])
    .filter((item): item is GeminiFunctionDeclaration & { name: string } => (
      typeof item.name === 'string' && item.name.trim() !== ''
    ))
    .map((item) => ({
      type: 'function' as const,
      function: {
        name: item.name.trim(),
        ...(typeof item.description === 'string' && item.description.trim() !== ''
          ? { description: item.description.trim() }
          : {}),
        ...(item.parameters != null && typeof item.parameters === 'object'
          ? { parameters: sanitizeGeminiSchemaForOpenAi(item.parameters) as Record<string, unknown> }
          : {})
      }
    }))

  return {
    model,
    stream: false,
    messages,
    ...(disableThinking ? { thinking: { type: 'disabled' as const } } : {}),
    ...(tools.length === 0 ? {} : { tools }),
    ...(normalizePositiveInteger(maxOutputTokens) == null
      ? {}
      : { max_tokens: normalizePositiveInteger(maxOutputTokens) })
  }
}

const normalizeOpenAiMessageText = (content: OpenAiMessageContent) => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => {
      if (typeof item?.text === 'string') return item.text
      if (item?.type === 'text' && typeof item?.text === 'string') return item.text
      return ''
    })
    .filter(text => text !== '')
    .join('\n\n')
}

const parseOpenAiToolArguments = (value: string | undefined) => {
  if (typeof value !== 'string' || value.trim() === '') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return asPlainObject(parsed)
  } catch {
    return {
      input: value
    }
  }
}

const mapFinishReason = (value: string | null | undefined) => {
  switch (value) {
    case 'length':
      return 'MAX_TOKENS'
    case 'content_filter':
      return 'SAFETY'
    case 'tool_calls':
    case 'function_call':
    case 'stop':
    default:
      return 'STOP'
  }
}

export const convertOpenAiResponseToGeminiResponse = (response: OpenAiChatCompletionResponse) => {
  const choice = response.choices?.[0]
  const message = choice?.message
  const text = normalizeOpenAiMessageText(message?.content)
  const toolCalls = message?.tool_calls ?? []
  const parts: Array<Record<string, unknown>> = [
    ...(text === ''
      ? []
      : [{
        text
      }]),
    ...toolCalls.map((toolCall) => ({
      functionCall: {
        name: toolCall.function?.name?.trim() || 'unknown_tool',
        args: parseOpenAiToolArguments(toolCall.function?.arguments)
      }
    }))
  ]

  return {
    candidates: [{
      index: 0,
      content: {
        role: 'model',
        parts
      },
      finishReason: mapFinishReason(choice?.finish_reason)
    }],
    usageMetadata: {
      promptTokenCount: response.usage?.prompt_tokens ?? 0,
      candidatesTokenCount: response.usage?.completion_tokens ?? 0,
      totalTokenCount: response.usage?.total_tokens ?? (
        (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0)
      )
    }
  }
}

const buildEndpointWithQuery = (endpoint: string, queryParams: Record<string, string>) => {
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value)
  }
  return url
}

const fetchOpenAiCompletion = async (
  route: GeminiProxyRouteConfig,
  request: GeminiGenerateContentRequest
) => {
  const upstreamUrl = buildEndpointWithQuery(route.endpoint, route.queryParams ?? {})
  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${route.apiKey}`,
      ...(route.headers ?? {})
    },
    body: JSON.stringify(convertGeminiRequestToOpenAiRequest({
      disableThinking: route.disableThinking,
      maxOutputTokens: route.maxOutputTokens,
      model: route.model,
      request
    })),
    ...(normalizePositiveInteger(route.timeoutMs) == null
      ? {}
      : {
        signal: AbortSignal.timeout(normalizePositiveInteger(route.timeoutMs)!)
      })
  })

  const responseText = await upstreamResponse.text()
  let parsedResponse: OpenAiChatCompletionResponse | undefined
  try {
    parsedResponse = JSON.parse(responseText) as OpenAiChatCompletionResponse
  } catch {
  }

  if (!upstreamResponse.ok) {
    const errorMessage = parsedResponse?.error?.message?.trim() ||
      responseText.trim() ||
      `Upstream provider returned ${upstreamResponse.status}.`
    return {
      ok: false as const,
      status: upstreamResponse.status,
      body: errorMessage,
      details: parsedResponse ?? responseText
    }
  }

  if (parsedResponse == null) {
    return {
      ok: false as const,
      status: 502,
      body: 'Upstream provider returned a non-JSON response.',
      details: responseText
    }
  }

  return {
    ok: true as const,
    body: convertOpenAiResponseToGeminiResponse(parsedResponse)
  }
}

let proxyServerPromise: Promise<{ baseUrl: string }> | undefined
const proxyRoutes = new Map<string, GeminiProxyRouteConfig>()

const ensureGeminiProxyServer = async () => {
  if (proxyServerPromise == null) {
    proxyServerPromise = new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        try {
          if (req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' })
            res.end()
            return
          }

          const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
          const match = REQUEST_PATH_RE.exec(requestUrl.pathname)
          const routeKey = match?.groups?.routeKey
          const requestMethod = match?.groups?.method
          if (routeKey == null || requestMethod == null) {
            writeGeminiError(res, 404, 'Unsupported Gemini proxy request path.')
            return
          }

          const route = proxyRoutes.get(routeKey)
          if (route == null) {
            writeGeminiError(res, 404, 'Unknown Gemini proxy route.')
            return
          }

          const requestBodyText = await readRequestBody(req)
          const requestBody = JSON.parse(requestBodyText) as GeminiGenerateContentRequest
          const upstream = await fetchOpenAiCompletion(route, requestBody)
          if (!upstream.ok) {
            writeGeminiError(res, upstream.status, upstream.body, upstream.details)
            return
          }

          if (requestMethod === 'streamGenerateContent') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache'
            })
            res.write(`data: ${JSON.stringify(upstream.body)}\n\n`)
            res.end()
            return
          }

          writeJson(res, 200, upstream.body)
        } catch (error) {
          writeGeminiError(
            res,
            500,
            error instanceof Error ? error.message : String(error)
          )
        }
      })

      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.unref()
        server.off('error', reject)
        const address = server.address()
        if (address == null || typeof address === 'string') {
          reject(new Error('Failed to resolve Gemini proxy address.'))
          return
        }
        resolve({
          baseUrl: `http://127.0.0.1:${address.port}`
        })
      })
    })
  }

  return proxyServerPromise
}

export const resolveGeminiModelServiceRoute = (params: {
  model: string
  service: ModelServiceConfig
  serviceKey: string
}): GeminiProxyRouteConfig => {
  const endpoint = normalizeServiceEndpoint(params.service.apiBaseUrl)
  const geminiExtra = asPlainObject(asPlainObject(params.service.extra).gemini)
  const disableThinking = typeof geminiExtra.disableThinking === 'boolean'
    ? geminiExtra.disableThinking
    : params.serviceKey.toLowerCase() === 'kimi' || new URL(endpoint).hostname.endsWith('moonshot.ai')

  return {
    apiKey: params.service.apiKey,
    disableThinking,
    endpoint,
    headers: normalizeGeminiServiceExtra(params.service),
    maxOutputTokens: normalizePositiveInteger(params.service.maxOutputTokens),
    model: params.model,
    queryParams: normalizeGeminiServiceQueryParams(params.service),
    serviceKey: params.serviceKey,
    timeoutMs: normalizePositiveInteger(params.service.timeoutMs)
  }
}

export const ensureGeminiProxyRoute = async (route: GeminiProxyRouteConfig) => {
  const proxy = await ensureGeminiProxyServer()
  const routeKey = randomUUID().replace(/-/gu, '')
  proxyRoutes.set(routeKey, route)
  return {
    routeKey,
    baseUrl: `${proxy.baseUrl}/${routeKey}`
  }
}
