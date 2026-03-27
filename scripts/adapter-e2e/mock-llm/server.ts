import { createServer } from 'node:http'

import { isDebugEnabled } from '../runtime'
import type { MockLlmServerHandle, MockLlmServerOptions, MockLlmTraceEntry } from '../types'
import { writeChatCompletionResult } from './chat-completions'
import { writeJson } from './http'
import { resolveMockTurn } from './registry'
import {
  asArray,
  asObject,
  getRequestInputs,
  getRequestText,
  hasToolResult,
  isStreamRequest,
  isTitleGenerationRequest,
  readJsonBody
} from './request'
import { writeResponsesResult } from './responses'
import { pickToolCall } from './tooling'

const createDebugLogger = (enabled: boolean) => (...args: unknown[]) => {
  if (!enabled) return
  console.error('[adapter-e2e:debug]', ...args)
}

export const startMockLlmServer = async (
  options: MockLlmServerOptions = {}
): Promise<MockLlmServerHandle> => {
  const scenarios = options.scenarios ?? []
  const logDebug = createDebugLogger(options.debug ?? isDebugEnabled)
  const trace: MockLlmTraceEntry[] = []
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { ok: true })
      return
    }

    if (req.method !== 'POST' || req.url == null) {
      writeJson(res, 404, { error: 'not_found' })
      return
    }

    const body = await readJsonBody(req).catch(() => undefined)
    if (body == null) {
      writeJson(res, 400, { error: 'invalid_json' })
      return
    }

    const requestPath = req.url.split('?')[0]
    const model = typeof body.model === 'string' && body.model.trim() !== ''
      ? body.model
      : 'hook-smoke-mock,unknown'
    const requestedToolCount = asArray(body.tools).length
    const selectedTool = pickToolCall(body)
    const shouldRejectForUnsupportedTool = !isTitleGenerationRequest(body) &&
      !hasToolResult(body) &&
      requestedToolCount > 0 &&
      selectedTool == null
    let turn
    try {
      turn = resolveMockTurn(scenarios, model, body)
    } catch (error) {
      logDebug(
        'mock-llm unknown scenario',
        JSON.stringify({
          model,
          requestPath
        })
      )
      writeJson(res, 404, {
        error: 'unknown_model_scenario',
        message: error instanceof Error ? error.message : `No mock model scenario registered for ${model}`,
        model
      })
      return
    }
    const traceEntry: MockLlmTraceEntry = {
      path: requestPath,
      model,
      requestText: getRequestText(body),
      inputTypes: getRequestInputs(body).map((item) => {
        const value = asObject(item)
        return String(value.type ?? value.role ?? 'unknown')
      }),
      requestedToolCount,
      selectedTool,
      response: turn
    }
    trace.push(traceEntry)

    logDebug(
      'mock-llm request',
      JSON.stringify({
        ...traceEntry,
        stream: isStreamRequest(body, req.headers.accept),
        turn: turn.kind,
        toolCount: requestedToolCount
      })
    )

    if (shouldRejectForUnsupportedTool) {
      writeJson(res, 422, { error: 'no_supported_tool_available' })
      return
    }

    if (requestPath.endsWith('/responses')) {
      writeResponsesResult(res, {
        model,
        text: turn.kind === 'message' ? turn.text : undefined,
        tool: turn.kind === 'tool' ? turn.tool : undefined,
        stream: isStreamRequest(body, req.headers.accept)
      })
      return
    }

    if (requestPath.endsWith('/chat/completions')) {
      writeChatCompletionResult(res, {
        model,
        text: turn.kind === 'message' ? turn.text : undefined,
        tool: turn.kind === 'tool' ? turn.tool : undefined,
        stream: isStreamRequest(body, req.headers.accept)
      })
      return
    }

    writeJson(res, 404, { error: 'unsupported_path', path: requestPath })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Failed to determine mock LLM server address')
  }

  return {
    port: address.port,
    getTrace: () => [...trace],
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error != null) reject(error)
          else resolve()
        })
      })
    }
  }
}

export { resolveMockScenario, resolveMockTurn } from './registry'
export { hasToolResult, isTitleGenerationRequest } from './request'
export { pickToolCall } from './tooling'
