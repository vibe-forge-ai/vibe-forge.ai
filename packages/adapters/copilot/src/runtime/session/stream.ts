import type { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import process from 'node:process'

import type {
  AdapterCtx,
  AdapterEvent,
  AdapterOutputEvent,
  AdapterQueryOptions,
  AdapterSession,
  ChatMessage
} from '@vibe-forge/types'
import { uuid } from '@vibe-forge/utils/uuid'

import { resolveCopilotBinaryPath } from '#~/paths.js'
import {
  DEFAULT_COPILOT_TOOLS,
  buildCopilotBaseArgs,
  buildCopilotChildEnv,
  createAssistantMessage,
  ensureCopilotSessionMarker,
  getErrorMessage,
  normalizeCopilotPrompt,
  resolveAdapterConfig,
  resolveCopilotModelConfig,
  toAdapterErrorData
} from '../shared'

interface CopilotJsonEvent {
  type?: string
  data?: Record<string, unknown>
  sessionId?: string
  exitCode?: number
  usage?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const asString = (value: unknown) => typeof value === 'string' ? value : undefined

const stringifyUnknown = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const stringifyTextContent = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (isRecord(item)) {
          return asString(item.text) ?? asString(item.content) ?? ''
        }
        return ''
      })
      .join('')
  }
  if (isRecord(value)) {
    return asString(value.text) ?? asString(value.content) ?? stringifyUnknown(value)
  }
  return stringifyUnknown(value)
}

const createLineConsumer = (onLine: (line: string) => void) => {
  let buffer = ''

  return {
    push: (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let index = buffer.indexOf('\n')
      while (index !== -1) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (line !== '') onLine(line)
        index = buffer.indexOf('\n')
      }
    },
    flush: () => {
      const line = buffer.trim()
      buffer = ''
      if (line !== '') onLine(line)
    }
  }
}

const createToolUseMessage = (event: CopilotJsonEvent): ChatMessage | undefined => {
  const data = event.data
  if (!isRecord(data)) return undefined

  const toolCallId = asString(data.toolCallId) ?? asString(data.id) ?? uuid()
  const toolName = asString(data.toolName) ??
    asString(data.tool) ??
    asString(data.mcpToolName) ??
    asString(data.name) ??
    'tool'

  return {
    id: toolCallId,
    role: 'assistant',
    content: [{
      type: 'tool_use',
      id: toolCallId,
      name: `adapter:copilot:${toolName}`,
      input: data.arguments ?? data.input ?? data.args ?? {}
    }],
    createdAt: Date.now()
  }
}

const createAgentMessage = (
  event: CopilotJsonEvent,
  options: AdapterQueryOptions
): ChatMessage | undefined => {
  const data = event.data
  if (!isRecord(data)) return undefined
  const content = stringifyTextContent(data.message ?? data.content ?? data.text ?? data.delta)
  if (content.trim() === '') return undefined

  return {
    id: asString(data.messageId) ?? asString(data.id) ?? uuid(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
    ...(options.model != null ? { model: options.model } : {})
  }
}

const mergePendingAgentMessage = (
  pending: ChatMessage | undefined,
  next: ChatMessage
): ChatMessage => {
  if (pending == null) return next
  return {
    ...next,
    id: pending.id,
    content: `${stringifyTextContent(pending.content)}${stringifyTextContent(next.content)}`,
    createdAt: pending.createdAt
  }
}

const applyPendingMessageId = (
  event: CopilotJsonEvent,
  message: ChatMessage,
  pending: ChatMessage | undefined
): ChatMessage => {
  if (pending == null) return message
  const data = event.data
  const hasExplicitId = isRecord(data) && (asString(data.messageId) != null || asString(data.id) != null)
  return hasExplicitId ? message : { ...message, id: pending.id }
}

const createToolResultMessage = (event: CopilotJsonEvent): ChatMessage | undefined => {
  const data = event.data
  if (!isRecord(data)) return undefined

  const toolCallId = asString(data.toolCallId) ?? asString(data.id)
  if (toolCallId == null) return undefined

  const error = data.error
  const result = data.result ?? data.output ?? data.content
  return {
    id: uuid(),
    role: 'assistant',
    content: [{
      type: 'tool_result',
      tool_use_id: toolCallId,
      content: error != null ? stringifyUnknown(error) : stringifyUnknown(result),
      is_error: error != null || data.success === false
    }],
    createdAt: Date.now()
  }
}

const formatSessionError = (event: CopilotJsonEvent) => {
  const data = event.data
  if (!isRecord(data)) return 'Copilot session failed'
  return asString(data.message) ??
    asString(data.error) ??
    asString(isRecord(data.error) ? data.error.message : undefined) ??
    stringifyUnknown(data) ??
    'Copilot session failed'
}

export const createStreamCopilotSession = async (
  ctx: AdapterCtx,
  options: AdapterQueryOptions
): Promise<AdapterSession> => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const binaryPath = resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath, ctx.cwd, adapterConfig.cli)
  const childEnv = await buildCopilotChildEnv(ctx, options, adapterConfig)
  const model = resolveCopilotModelConfig(ctx, options.model).cliModel ?? options.model ?? 'default'

  await ensureCopilotSessionMarker(ctx, options.sessionId)

  options.onEvent({
    type: 'init',
    data: {
      uuid: options.sessionId,
      model,
      effort: options.effort,
      version: 'unknown',
      tools: DEFAULT_COPILOT_TOOLS,
      slashCommands: [],
      cwd: ctx.cwd,
      agents: adapterConfig.agent ? [adapterConfig.agent] : [],
      assetDiagnostics: options.assetPlan?.diagnostics
    }
  })

  let destroyed = false
  let stopping = false
  let currentPid: number | undefined
  let currentKill: (() => void) | undefined
  let didEmitFatalError = false
  let didEmitExit = false
  const messageDeltas = new Map<string, string>()

  const emitEvent = (event: AdapterOutputEvent) => {
    if (event.type === 'error' && event.data.fatal !== false) {
      didEmitFatalError = true
    }
    options.onEvent(event)
  }
  const emitExit = (data: { exitCode: number; stderr?: string }) => {
    if (didEmitExit) return
    didEmitExit = true
    emitEvent({ type: 'exit', data })
  }

  const emitUnexpectedExit = (error: unknown) => {
    if (destroyed) return
    destroyed = true
    currentPid = undefined
    currentKill = undefined
    ctx.logger.error('Copilot session turn failed unexpectedly', { err: error })
    emitEvent({ type: 'error', data: toAdapterErrorData(error) })
    emitExit({ exitCode: 1, stderr: getErrorMessage(error) })
  }

  const handleJsonEvent = (event: CopilotJsonEvent, state: {
    lastAssistantMessage?: ChatMessage
    pendingAgentMessage?: ChatMessage
    sawAssistantMessage: boolean
    rawTextParts: string[]
  }) => {
    if (event.type === 'assistant.message_delta') {
      const data = event.data
      if (!isRecord(data)) return
      const messageId = asString(data.messageId) ?? 'default'
      const delta = asString(data.deltaContent)
      if (delta != null && delta !== '') {
        messageDeltas.set(messageId, `${messageDeltas.get(messageId) ?? ''}${delta}`)
      }
      return
    }

    if (event.type === 'agent.message') {
      const message = createAgentMessage(event, options)
      if (message == null) return
      state.pendingAgentMessage = mergePendingAgentMessage(state.pendingAgentMessage, message)
      return
    }

    if (event.type === 'assistant.message') {
      const data = event.data
      if (!isRecord(data)) return
      const messageId = asString(data.messageId) ?? uuid()
      const content = asString(data.content) ?? messageDeltas.get(messageId) ?? ''
      messageDeltas.delete(messageId)
      if (content.trim() === '') return

      const message: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content,
        createdAt: Date.now(),
        ...(options.model != null ? { model: options.model } : {})
      }
      state.sawAssistantMessage = true
      state.lastAssistantMessage = message
      emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'tool.execution_start') {
      const message = createToolUseMessage(event)
      if (message != null) emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'tool.call') {
      const message = createToolUseMessage(event)
      if (message != null) emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'tool.execution_complete') {
      const message = createToolResultMessage(event)
      if (message != null) emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'tool.result') {
      const message = createToolResultMessage(event)
      if (message != null) emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'agent.completed') {
      const parsedMessage = createAgentMessage(event, options)
      if (parsedMessage == null) {
        if (state.pendingAgentMessage != null) {
          state.lastAssistantMessage = state.pendingAgentMessage
          state.pendingAgentMessage = undefined
          state.sawAssistantMessage = true
          emitEvent({ type: 'message', data: state.lastAssistantMessage })
        }
        return
      }
      const message = applyPendingMessageId(event, parsedMessage, state.pendingAgentMessage)
      state.pendingAgentMessage = undefined
      state.sawAssistantMessage = true
      state.lastAssistantMessage = message
      emitEvent({ type: 'message', data: message })
      return
    }

    if (event.type === 'session.error') {
      emitEvent({
        type: 'error',
        data: toAdapterErrorData(formatSessionError(event), {
          details: event.data
        })
      })
      return
    }

    if (event.type === 'agent.error') {
      emitEvent({
        type: 'error',
        data: toAdapterErrorData(formatSessionError(event), {
          details: event.data
        })
      })
      return
    }

    if (event.type === 'session.created' || event.type === 'result') {
      return
    }

    ctx.logger.debug('Ignoring unknown Copilot JSON event', {
      type: event.type,
      data: event.data
    })
  }

  const runTurn = async (content: Extract<AdapterEvent, { type: 'message' }>): Promise<void> => {
    if (destroyed) return
    const prompt = normalizeCopilotPrompt(content.content)
    if (prompt === '') return

    const args = await buildCopilotBaseArgs({
      ctx,
      options,
      adapterConfig,
      prompt,
      outputFormat: 'json'
    })

    const state: {
      lastAssistantMessage?: ChatMessage
      pendingAgentMessage?: ChatMessage
      sawAssistantMessage: boolean
      rawTextParts: string[]
    } = {
      sawAssistantMessage: false,
      rawTextParts: []
    }

    const proc = spawn(binaryPath, args, {
      cwd: ctx.cwd,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    currentPid = proc.pid
    currentKill = () => {
      if (proc.pid != null) {
        try {
          process.kill(proc.pid, 'SIGINT')
        } catch {
        }
      }
    }

    let stderr = ''
    const stdoutConsumer = createLineConsumer((line) => {
      try {
        handleJsonEvent(JSON.parse(line) as CopilotJsonEvent, state)
      } catch {
        state.rawTextParts.push(line)
      }
    })

    proc.stdout?.on('data', chunk => stdoutConsumer.push(chunk))
    proc.stderr?.on('data', chunk => {
      stderr += chunk.toString()
    })

    const exitCode = await new Promise<number>((resolve, reject) => {
      proc.on('error', reject)
      proc.on('exit', code => resolve(code ?? 0))
    })

    stdoutConsumer.flush()
    currentPid = undefined
    currentKill = undefined

    if (destroyed) {
      emitExit({ exitCode: stopping ? 0 : exitCode, stderr: stderr.trim() || undefined })
      return
    }

    if (exitCode !== 0) {
      if (!didEmitFatalError) {
        emitEvent({
          type: 'error',
          data: toAdapterErrorData(stderr.trim() || `Process exited with code ${exitCode}`, {
            details: {
              exitCode,
              stderr
            }
          })
        })
      }
      emitExit({ exitCode, stderr: stderr.trim() || undefined })
      return
    }

    if (!state.sawAssistantMessage && state.pendingAgentMessage != null) {
      state.lastAssistantMessage = state.pendingAgentMessage
      state.pendingAgentMessage = undefined
      state.sawAssistantMessage = true
      emitEvent({ type: 'message', data: state.lastAssistantMessage })
    }

    if (!state.sawAssistantMessage) {
      const fallback = state.rawTextParts.join('\n').trim()
      if (fallback !== '') {
        state.lastAssistantMessage = createAssistantMessage(fallback, options.model)
        emitEvent({ type: 'message', data: state.lastAssistantMessage })
      }
    }

    emitEvent({ type: 'stop', data: state.lastAssistantMessage })
  }

  let queue = Promise.resolve()
  const enqueueMessage = (event: Extract<AdapterEvent, { type: 'message' }>) => {
    queue = queue.catch(() => undefined).then(async () => {
      try {
        await runTurn(event)
      } catch (error) {
        emitUnexpectedExit(error)
      }
    })
  }

  if (options.description != null && options.description.trim() !== '') {
    enqueueMessage({ type: 'message', content: [{ type: 'text', text: options.description }] })
  }

  return {
    kill: () => {
      destroyed = true
      currentKill?.()
    },
    stop: () => {
      if (destroyed) return
      destroyed = true
      stopping = true
      currentKill?.()
      if (currentPid == null) {
        emitExit({ exitCode: 0 })
      }
    },
    emit: (event) => {
      if (destroyed) return
      if (event.type === 'message') enqueueMessage(event)
      if (event.type === 'interrupt') currentKill?.()
      if (event.type === 'stop') {
        destroyed = true
        stopping = true
        currentKill?.()
      }
    },
    get pid() {
      return currentPid
    }
  }
}
