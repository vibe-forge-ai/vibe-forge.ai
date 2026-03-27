#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const cliPath = path.resolve(repoRoot, 'apps/cli/cli.js')
const cliPackageDir = path.resolve(repoRoot, 'apps/cli')
const opencodeBin = path.resolve(repoRoot, 'packages/adapters/opencode/node_modules/.bin/opencode')
const mockHome = path.resolve(repoRoot, '.ai/.mock')
const realHome = process.env.HOME ?? ''
const mockModelService = 'hook-smoke-mock'
const mockClaudeService = 'hook-smoke-mock-ccr'
const isDebugEnabled = process.env.HOOK_SMOKE_DEBUG === '1'

const REQUESTS = {
  codex: {
    expectedOutput: 'E2E_CODEX',
    expectedEvents: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'],
    model: `${mockModelService},codex-hooks`,
    args: (sessionId) => [
      cliPath,
      '--adapter', 'codex',
      '--model', `${mockModelService},codex-hooks`,
      '--print',
      '--no-inject-default-system-prompt',
      '--permission-mode', 'bypassPermissions',
      '--exclude-mcp-server', 'ChromeDevtools',
      '--session-id', sessionId,
      'Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else.'
    ]
  },
  'claude-code': {
    expectedOutput: 'E2E_CLAUDE',
    expectedEvents: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'],
    model: `${mockClaudeService},claude-hooks`,
    args: (sessionId) => [
      cliPath,
      '--adapter', 'claude-code',
      '--model', `${mockClaudeService},claude-hooks`,
      '--print',
      '--no-inject-default-system-prompt',
      '--exclude-mcp-server', 'ChromeDevtools',
      '--include-tool', 'Read',
      '--permission-mode', 'bypassPermissions',
      '--session-id', sessionId,
      'Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else.'
    ]
  },
  opencode: {
    expectedOutput: 'E2E_OPENCODE',
    expectedEvents: ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'],
    model: `${mockModelService},opencode-hooks`,
    args: (sessionId) => [
      cliPath,
      '--adapter', 'opencode',
      '--model', `${mockModelService},opencode-hooks`,
      '--print',
      '--no-inject-default-system-prompt',
      '--exclude-mcp-server', 'ChromeDevtools',
      '--session-id', sessionId,
      'Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else.'
    ]
  }
}

const toProviderModel = (model) => {
  if (!model.includes(',')) return model
  const [providerId, modelId] = model.split(',', 2)
  return `${providerId}/${modelId}`
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const debugLog = (...args) => {
  if (!isDebugEnabled) return
  console.error('[hooks-smoke:debug]', ...args)
}

const killProcessTree = (pid, signal) => {
  if (pid == null) return

  try {
    if (process.platform !== 'win32') {
      process.kill(-pid, signal)
      return
    }
  } catch {
  }

  try {
    process.kill(pid, signal)
  } catch {
  }
}

const pathExists = async (targetPath) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const waitForPath = async (targetPath, timeoutMs = 5_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await pathExists(targetPath)) return true
    await sleep(200)
  }
  return false
}

const runProcess = async ({
  command,
  args,
  env,
  timeoutMs
}) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const stdoutChunks = []
  const stderrChunks = []
  let timedOut = false
  let forceKillTimer

  child.stdout.on('data', (chunk) => {
    stdoutChunks.push(chunk)
    process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk)
    process.stderr.write(chunk)
  })

  const timeout = timeoutMs != null
    ? setTimeout(() => {
        timedOut = true
        killProcessTree(child.pid, 'SIGTERM')
        forceKillTimer = setTimeout(() => {
          killProcessTree(child.pid, 'SIGKILL')
        }, 5_000)
      }, timeoutMs)
    : undefined

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (timeout != null) clearTimeout(timeout)
      if (forceKillTimer != null) clearTimeout(forceKillTimer)
      resolve({
        code: code ?? (timedOut ? -1 : 0),
        signal,
        timedOut,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8')
      })
    })
  })

  return result
}

const buildBaseEnv = (ctxId, mockServerPort) => ({
  ...process.env,
  __VF_PROJECT_AI_CTX_ID__: ctxId,
  __VF_PROJECT_WORKSPACE_FOLDER__: repoRoot,
  HOOK_SMOKE_MOCK_PORT: String(mockServerPort)
})

const resolveLogPath = (ctxId, sessionId) => (
  path.resolve(repoRoot, '.ai/logs', ctxId, `${sessionId}.log.md`)
)

const verifyLog = async ({ ctxId, sessionId, expectedEvents }) => {
  const logPath = resolveLogPath(ctxId, sessionId)
  const exists = await waitForPath(logPath, 2_000)
  if (!exists) {
    throw new Error(`Smoke log not found: ${logPath}`)
  }

  const content = await readFile(logPath, 'utf8')
  for (const eventName of expectedEvents) {
    if (!content.includes(`[${eventName}]`)) {
      throw new Error(`Missing hook event ${eventName} in ${logPath}`)
    }
  }

  return logPath
}

const ensureExpectedOutput = (stdout, expectedOutput) => {
  if (!stdout.includes(expectedOutput)) {
    throw new Error(`Expected output ${expectedOutput} not found in stdout`)
  }
}

const readJsonBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw === '' ? {} : JSON.parse(raw)
}

const writeJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

const writeSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

const getRequestInputs = (body) => (
  Array.isArray(body.input)
    ? body.input
    : Array.isArray(body.messages)
    ? body.messages
    : []
)

const getRequestText = (body) => (
  getRequestInputs(body)
    .flatMap((item) => {
      if (typeof item?.content === 'string') return [item.content]
      if (!Array.isArray(item?.content)) return [typeof item?.text === 'string' ? item.text : '']
      return item.content.map(part => {
        if (typeof part?.text === 'string') return part.text
        if (typeof part?.input_text === 'string') return part.input_text
        return ''
      })
    })
    .filter(text => text.trim() !== '')
    .join('\n')
)

const isTitleGenerationRequest = (body) => {
  const requestText = getRequestText(body)
  return requestText.includes('Generate a title for this conversation')
    || requestText.includes('You are a title generator')
}

const resolveSmokeOutput = (model, body) => {
  if (isTitleGenerationRequest(body)) {
    if (model?.includes('codex-hooks')) return 'Codex hook smoke'
    if (model?.includes('claude-hooks')) return 'Claude hook smoke'
    return 'OpenCode hook smoke'
  }

  return model?.includes('codex-hooks')
    ? REQUESTS.codex.expectedOutput
    : model?.includes('claude-hooks')
    ? REQUESTS['claude-code'].expectedOutput
    : REQUESTS.opencode.expectedOutput
}

const hasToolResult = (body) => getRequestInputs(body).some(item => {
  if (item?.type === 'function_call_output') return true
  if (item?.role === 'tool') return true
  return false
})

const getToolName = (tool) => {
  if (typeof tool?.name === 'string' && tool.name.trim() !== '') return tool.name
  if (typeof tool?.function?.name === 'string' && tool.function.name.trim() !== '') return tool.function.name
  if (typeof tool?.type === 'string' && tool.type.trim() !== '' && tool.type !== 'function') return tool.type
  return undefined
}

const getToolParameters = (tool) => (
  tool?.parameters
    ?? tool?.function?.parameters
    ?? tool?.input_schema
    ?? tool?.inputSchema
)

const resolveToolArgs = (toolName, toolParameters) => {
  const normalized = toolName.toLowerCase()
  const properties = toolParameters?.properties ?? {}
  if (
    normalized === 'read'
    || 'filePath' in properties
    || 'file_path' in properties
    || 'path' in properties
  ) {
    return {
      ...('file_path' in properties ? { file_path: path.resolve(repoRoot, 'README.md') } : {}),
      ...('filePath' in properties || !('file_path' in properties) ? { filePath: path.resolve(repoRoot, 'README.md') } : {}),
      ...('path' in properties ? { path: path.resolve(repoRoot, 'README.md') } : {}),
      offset: 1,
      limit: 2000
    }
  }
  if (normalized === 'exec_command' || 'cmd' in properties) {
    return {
      cmd: "sed -n '1,200p' README.md",
      workdir: repoRoot,
      yield_time_ms: 1000,
      max_output_tokens: 2000
    }
  }
  if (
    normalized === 'bash' ||
    normalized === 'shell' ||
    normalized === 'local_shell' ||
    'command' in properties
  ) {
    return {
      command: "sed -n '1,200p' README.md"
    }
  }
  return {}
}

const pickSmokeTool = (body) => {
  const tools = Array.isArray(body.tools) ? body.tools : []
  const namedTools = tools
    .map(tool => {
      const name = getToolName(tool)
      const parameters = getToolParameters(tool)
      return {
        name,
        original: tool,
        parameters,
        args: typeof name === 'string' ? resolveToolArgs(name, parameters) : {}
      }
    })
    .filter(item => typeof item.name === 'string')

  const preferred = namedTools.find(item => item.name.toLowerCase() === 'read')
    ?? namedTools.find(item => item.name.toLowerCase() === 'exec_command')
    ?? namedTools.find(item => item.name.toLowerCase() === 'bash')
    ?? namedTools.find(item => item.name.toLowerCase() === 'shell')
    ?? namedTools.find(item => Object.keys(item.args).length > 0)

  if (preferred == null) {
    if (tools.length > 0) {
      console.error('[hooks-smoke] no supported tool found in request', JSON.stringify(tools, null, 2))
    }
    return undefined
  }

  return {
    name: preferred.name,
    args: preferred.args
  }
}

const buildResponseObject = ({ model, output }) => ({
  id: `resp_${randomUUID().replace(/-/g, '')}`,
  object: 'response',
  created_at: Math.floor(Date.now() / 1000),
  model,
  output,
  parallel_tool_calls: false,
  usage: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  }
})

const buildResponsesToolCall = ({ toolName, toolArgs }) => {
  const callId = `call_${randomUUID().replace(/-/g, '')}`
  return {
    id: callId,
    type: 'function_call',
    status: 'completed',
    call_id: callId,
    name: toolName,
    arguments: JSON.stringify(toolArgs)
  }
}

const buildResponsesMessage = (text) => {
  const itemId = `msg_${randomUUID().replace(/-/g, '')}`
  return {
    id: itemId,
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [
      {
        type: 'output_text',
        text
      }
    ]
  }
}

const writeResponsesStream = (res, response, extraEvents = []) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive'
  })

  writeSseEvent(res, 'response.created', {
    type: 'response.created',
    response: {
      id: response.id,
      model: response.model,
      output: []
    }
  })

  for (const event of extraEvents) {
    writeSseEvent(res, event.type, event)
  }

  writeSseEvent(res, 'response.completed', {
    type: 'response.completed',
    response
  })
  res.end()
}

const buildStreamingToolCallItem = (toolCall) => ({
  ...toolCall,
  status: 'in_progress',
  arguments: ''
})

const buildStreamingMessageItem = (message) => ({
  ...message,
  status: 'in_progress',
  content: [
    {
      type: 'output_text',
      text: ''
    }
  ]
})

const buildChatCompletionResponse = ({ model, text, toolCall }) => ({
  id: `chatcmpl_${randomUUID().replace(/-/g, '')}`,
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: text ?? null,
        ...(toolCall != null
          ? {
              tool_calls: [
                {
                  id: toolCall.call_id,
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments
                  }
                }
              ]
            }
          : {})
      },
      finish_reason: toolCall != null ? 'tool_calls' : 'stop'
    }
  ],
  usage: {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  }
})

const writeChatCompletionsStream = (res, { model, text, toolCall }) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive'
  })

  if (toolCall != null) {
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: toolCall.call_id,
                type: 'function',
                function: {
                  name: toolCall.name,
                  arguments: toolCall.arguments
                }
              }
            ]
          },
          finish_reason: null
        }
      ]
    })
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls'
        }
      ]
    })
  } else {
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: text
          },
          finish_reason: null
        }
      ]
    })
    writeSseEvent(res, 'message', {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    })
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

const startMockLlmServer = async () => {
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { ok: true })
      return
    }

    if (req.method !== 'POST' || req.url == null) {
      writeJson(res, 404, { error: 'not_found' })
      return
    }

    const requestPath = req.url.split('?')[0]
    const body = await readJsonBody(req).catch(() => undefined)
    if (body == null) {
      writeJson(res, 400, { error: 'invalid_json' })
      return
    }

    const model = typeof body.model === 'string' && body.model.trim() !== ''
      ? body.model
      : `${mockModelService},unknown`
    const finalText = resolveSmokeOutput(model, body)
    const shouldReturnToolCall = !hasToolResult(body)
    const tool = shouldReturnToolCall ? pickSmokeTool(body) : undefined
    debugLog('request', JSON.stringify({
      path: requestPath,
      model,
      stream: body.stream === true || String(req.headers.accept ?? '').includes('text/event-stream'),
      shouldReturnToolCall,
      toolName: tool?.name,
      inputTypes: getRequestInputs(body).map(item => item?.type ?? item?.role ?? 'unknown'),
      toolCount: Array.isArray(body.tools) ? body.tools.length : 0
    }))

    if (requestPath.endsWith('/responses')) {
      if (shouldReturnToolCall && tool == null && Array.isArray(body.tools) && body.tools.length > 0) {
        writeJson(res, 422, { error: 'no_supported_tool_available' })
        return
      }

      if (shouldReturnToolCall && tool != null) {
        const toolCall = buildResponsesToolCall({
          toolName: tool.name,
          toolArgs: tool.args
        })
        const response = buildResponseObject({
          model,
          output: [toolCall]
        })
        debugLog('response', JSON.stringify({
          path: requestPath,
          type: 'tool_call',
          toolName: tool.name,
          toolArgs: tool.args
        }))

        if (body.stream === true || String(req.headers.accept ?? '').includes('text/event-stream')) {
          writeResponsesStream(res, response, [
            {
              type: 'response.output_item.added',
              output_index: 0,
              item: buildStreamingToolCallItem(toolCall),
              response: {
                id: response.id,
                model
              }
            },
            {
              type: 'response.function_call_arguments.delta',
              item_id: toolCall.id,
              output_index: 0,
              delta: toolCall.arguments,
              response: {
                id: response.id,
                model
              }
            },
            {
              type: 'response.function_call_arguments.done',
              item_id: toolCall.id,
              output_index: 0,
              arguments: toolCall.arguments,
              response: {
                id: response.id,
                model
              }
            },
            {
              type: 'response.output_item.done',
              output_index: 0,
              item: toolCall,
              response: {
                id: response.id,
                model
              }
            }
          ])
          return
        }

        writeJson(res, 200, response)
        return
      }

      const message = buildResponsesMessage(finalText)
      const response = buildResponseObject({
        model,
        output: [message]
      })
      debugLog('response', JSON.stringify({
        path: requestPath,
        type: 'message',
        text: finalText
      }))

      if (body.stream === true || String(req.headers.accept ?? '').includes('text/event-stream')) {
        writeResponsesStream(res, response, [
          {
            type: 'response.output_item.added',
            output_index: 0,
            item: buildStreamingMessageItem(message),
            response: {
              id: response.id,
              model
            }
          },
          {
            type: 'response.output_text.delta',
            item_id: message.id,
            output_index: 0,
            content_index: 0,
            delta: finalText,
            response: {
              id: response.id,
              model
            }
          },
          {
            type: 'response.output_text.done',
            item_id: message.id,
            output_index: 0,
            content_index: 0,
            text: finalText,
            response: {
              id: response.id,
              model
            }
          },
          {
            type: 'response.output_item.done',
            output_index: 0,
            item: message,
            response: {
              id: response.id,
              model
            }
          }
        ])
        return
      }

      writeJson(res, 200, response)
      return
    }

    if (requestPath.endsWith('/chat/completions')) {
      const toolCall = shouldReturnToolCall
        ? (() => {
            const selectedTool = pickSmokeTool(body)
            return selectedTool == null
              ? undefined
              : buildResponsesToolCall({
                  toolName: selectedTool.name,
                  toolArgs: selectedTool.args
                })
          })()
        : undefined

      if (shouldReturnToolCall && toolCall == null && Array.isArray(body.tools) && body.tools.length > 0) {
        writeJson(res, 422, { error: 'no_supported_tool_available' })
        return
      }

      const response = buildChatCompletionResponse({
        model,
        text: shouldReturnToolCall && toolCall != null ? undefined : finalText,
        toolCall
      })

      if (body.stream === true || String(req.headers.accept ?? '').includes('text/event-stream')) {
        writeChatCompletionsStream(res, {
          model,
          text: shouldReturnToolCall && toolCall != null ? undefined : finalText,
          toolCall
        })
        return
      }

      writeJson(res, 200, response)
      return
    }

    writeJson(res, 404, { error: 'unsupported_path', path: requestPath })
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(undefined))
  })

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Failed to determine mock LLM server address')
  }

  return {
    port: address.port,
    close: async () => {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve(undefined)
        })
      })
    }
  }
}

const runCodexOrClaudeSmoke = async (adapter, mockServerPort) => {
  const ctxId = process.env.HOOK_SMOKE_CTX_ID?.trim() || `hooks-smoke-${adapter}-${Date.now()}`
  const sessionId = process.env.HOOK_SMOKE_SESSION_ID?.trim() || randomUUID()
  const request = REQUESTS[adapter]
  const result = await runProcess({
    command: process.execPath,
    args: request.args(sessionId),
    env: buildBaseEnv(ctxId, mockServerPort),
    timeoutMs: Number(process.env.HOOK_SMOKE_TIMEOUT_MS ?? 180_000)
  })

  if (result.code !== 0) {
    throw new Error(`${adapter} smoke exited with code ${result.code}`)
  }

  ensureExpectedOutput(result.stdout, request.expectedOutput)
  const logPath = await verifyLog({ ctxId, sessionId, expectedEvents: request.expectedEvents })
  console.log(`\n[smoke:${adapter}] ok`)
  console.log(`ctxId=${ctxId}`)
  console.log(`sessionId=${sessionId}`)
  console.log(`log=${logPath}`)
}

const runOpenCodeUpstream = async ({ ctxId, sessionId, mockServerPort }) => {
  const request = REQUESTS.opencode
  const configDir = path.resolve(repoRoot, '.ai/.mock/.opencode-adapter', sessionId, 'config-dir')
  if (!await waitForPath(configDir, 5_000)) {
    throw new Error(`OpenCode config dir not found for fallback: ${configDir}`)
  }

  const result = await runProcess({
    command: opencodeBin,
    args: [
      'run',
      '--print-logs',
      '--format', 'json',
      '--model', toProviderModel(request.model),
      '--dir', repoRoot,
      'Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else.'
    ],
    env: {
      ...buildBaseEnv(ctxId, mockServerPort),
      HOME: mockHome,
      OPENCODE_CONFIG_DIR: configDir,
      __VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__: '1',
      __VF_PROJECT_NODE_PATH__: process.execPath,
      __VF_PROJECT_REAL_HOME__: realHome,
      __VF_PROJECT_CLI_PACKAGE_DIR__: cliPackageDir,
      __VF_PROJECT_PACKAGE_DIR__: cliPackageDir,
      __VF_OPENCODE_TASK_SESSION_ID__: sessionId,
      __VF_OPENCODE_HOOK_RUNTIME__: 'cli'
    },
    timeoutMs: Number(process.env.HOOK_SMOKE_TIMEOUT_MS ?? 180_000)
  })

  if (result.code !== 0) {
    throw new Error(`opencode upstream smoke exited with code ${result.code}`)
  }

  ensureExpectedOutput(result.stdout, request.expectedOutput)
  const logPath = await verifyLog({ ctxId, sessionId, expectedEvents: request.expectedEvents })
  console.log(`\n[smoke:opencode:upstream] ok`)
  console.log(`ctxId=${ctxId}`)
  console.log(`sessionId=${sessionId}`)
  console.log(`log=${logPath}`)
}

const runOpenCodeSmoke = async (mockServerPort) => {
  const adapter = 'opencode'
  const ctxId = process.env.HOOK_SMOKE_CTX_ID?.trim() || `hooks-smoke-${adapter}-${Date.now()}`
  const sessionId = process.env.HOOK_SMOKE_SESSION_ID?.trim() || randomUUID()
  const request = REQUESTS.opencode
  const wrapperTimeoutMs = Number(process.env.HOOK_SMOKE_OPENCODE_WRAPPER_TIMEOUT_MS ?? 20_000)
  const wrapperResult = await runProcess({
    command: process.execPath,
    args: request.args(sessionId),
    env: buildBaseEnv(ctxId, mockServerPort),
    timeoutMs: wrapperTimeoutMs
  })

  if (wrapperResult.code === 0 && !wrapperResult.timedOut && wrapperResult.stdout.includes(request.expectedOutput)) {
    const logPath = await verifyLog({ ctxId, sessionId, expectedEvents: request.expectedEvents })
    console.log(`\n[smoke:opencode] ok`)
    console.log(`ctxId=${ctxId}`)
    console.log(`sessionId=${sessionId}`)
    console.log(`log=${logPath}`)
    return
  }

  console.warn('\n[smoke:opencode] wrapper path did not complete cleanly, falling back to upstream CLI')
  await runOpenCodeUpstream({ ctxId, sessionId, mockServerPort })
}

const requested = process.argv[2] ?? 'all'
const tasks = requested === 'all'
  ? ['codex', 'claude-code', 'opencode']
  : [requested]

const mockServer = await startMockLlmServer()

try {
  for (const adapter of tasks) {
    if (adapter === 'codex' || adapter === 'claude-code') {
      await runCodexOrClaudeSmoke(adapter, mockServer.port)
      continue
    }
    if (adapter === 'opencode') {
      await runOpenCodeSmoke(mockServer.port)
      continue
    }
    throw new Error(`Unsupported smoke target: ${adapter}`)
  }
} finally {
  await mockServer.close()
}
