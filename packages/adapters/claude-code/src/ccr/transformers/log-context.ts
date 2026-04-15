// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { formatLoggerEntry, resolveProjectAiPath } from '@vibe-forge/utils'

const CLAUDE_CODE_SESSION_HEADER = 'x-claude-code-session-id'
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

const resolveCCRRequestLogContextPath = (workspace, sessionId) =>
  resolveProjectAiPath(workspace, process.env, '.mock', '.claude-code-router', 'request-log-context', `${sessionId}.json`)

const readHeaderValue = (headers, name) => {
  if (headers == null) return undefined

  if (typeof headers.get === 'function') {
    const value = headers.get(name)
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  }

  if (typeof headers !== 'object') return undefined

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) continue
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
    if (Array.isArray(value)) {
      const firstValue = value.find(
        (entry) => typeof entry === 'string' && entry.trim() !== ''
      )
      if (typeof firstValue === 'string') return firstValue.trim()
    }
  }

  return undefined
}

const resolveRequestSessionId = (context) => {
  const req = context?.req
  const headerSessionId = [
    req?.headers,
    req?.raw?.headers,
    req?.request?.headers
  ]
    .map((headers) => readHeaderValue(headers, CLAUDE_CODE_SESSION_HEADER))
    .find((value) => typeof value === 'string' && value !== '')

  if (typeof headerSessionId === 'string' && headerSessionId !== '') {
    return headerSessionId
  }

  return typeof req?.sessionId === 'string' && req.sessionId !== ''
    ? req.sessionId
    : undefined
}

const resolveStoredRequestLogContext = (sessionId) => {
  const workspace = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  if (
    typeof workspace !== 'string' ||
    workspace === '' ||
    typeof sessionId !== 'string' ||
    sessionId === ''
  ) {
    return undefined
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(resolveCCRRequestLogContextPath(workspace, sessionId), 'utf8')
    )
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      typeof parsed.ctxId === 'string' &&
      typeof parsed.sessionId === 'string'
    ) {
      return parsed
    }
  } catch {}

  return undefined
}

export const resolveRequestLogContext = (context) => {
  const req = context?.req

  if (req?.vfLogContext) {
    return req.vfLogContext
  }

  const sessionId = resolveRequestSessionId(context)
  const resolved = resolveStoredRequestLogContext(sessionId) ??
    (
      typeof sessionId === 'string' && sessionId !== ''
        ? {
          ctxId: sessionId,
          sessionId
        }
        : undefined
    )

  if (resolved != null && req != null) {
    req.vfLogContext = resolved
    if (typeof req.sessionId !== 'string' || req.sessionId === '') {
      req.sessionId = resolved.sessionId
    }
  }

  return resolved
}

const resolveRequestLogPath = (fileName, context, request) => {
  const logContext = resolveRequestLogContext(context)
  const workspace = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  const ctxId = logContext?.ctxId ?? process.env.__VF_PROJECT_AI_CTX_ID__
  const sessionId = logContext?.sessionId ?? process.env.__VF_PROJECT_AI_SESSION_ID__

  if (
    typeof workspace !== 'string' ||
    workspace === '' ||
    typeof ctxId !== 'string' ||
    ctxId === '' ||
    typeof sessionId !== 'string' ||
    sessionId === ''
  ) {
    return path.join(CURRENT_DIR, 'temp.log.md')
  }

  return path.join(
    resolveProjectAiPath(workspace, process.env, 'logs', ctxId, sessionId, 'adapter-claude-code'),
    fileName
  )
}

export const writeRequestDebugLog = (fileName, message, data = null, context, request) => {
  try {
    const logPath = resolveRequestLogPath(fileName, context, request)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.appendFileSync(
      logPath,
      formatLoggerEntry('D', data == null ? [message] : [message, data])
    )
  } catch (error) {
    fs.appendFileSync(
      path.join(CURRENT_DIR, 'temp.log.md'),
      formatLoggerEntry('E', [error])
    )
  }
}

const parseResponseDebugBody = (bodyText, contentType) => {
  if (typeof bodyText !== 'string' || bodyText === '') {
    return null
  }

  if (typeof contentType === 'string' && contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyText)
    } catch {}
  }

  if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
    return parseEventStreamDebugBody(bodyText)
  }

  return bodyText
}

const parseEventStreamEvents = (bodyText) => {
  const chunks = bodyText
    .replace(/\r\n/g, '\n')
    .split('\n\n')
    .map(chunk => chunk.trim())
    .filter(Boolean)

  return chunks.map((chunk) => {
    const lines = chunk.split('\n')
    const eventLines = []
    const dataLines = []

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventLines.push(line.slice('event:'.length).trim())
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    const dataText = dataLines.join('\n')
    if (dataText === '[DONE]') {
      return {
        event: eventLines[0],
        type: 'done',
        data: '[DONE]'
      }
    }

    try {
      return {
        event: eventLines[0],
        type: 'json',
        data: JSON.parse(dataText)
      }
    } catch {
      return {
        event: eventLines[0],
        type: 'text',
        data: dataText === '' ? chunk : dataText
      }
    }
  })
}

const appendStreamText = (currentValue, nextValue) => {
  if (nextValue == null) return currentValue
  if (typeof nextValue === 'string') {
    return `${typeof currentValue === 'string' ? currentValue : ''}${nextValue}`
  }
  if (Array.isArray(nextValue)) {
    const baseValue = Array.isArray(currentValue)
      ? currentValue
      : currentValue == null
      ? []
      : [currentValue]
    return [...baseValue, ...nextValue]
  }
  return nextValue
}

const assembleChatCompletionStream = (events) => {
  const jsonEvents = events
    .filter(event => event.type === 'json' && event.data?.object === 'chat.completion.chunk')
    .map(event => event.data)

  if (jsonEvents.length === 0) {
    return undefined
  }

  const choices = new Map()

  for (const chunk of jsonEvents) {
    for (const choice of chunk.choices ?? []) {
      const state = choices.get(choice.index) ?? {
        index: choice.index,
        role: undefined,
        content: '',
        thinking: {},
        annotations: [],
        toolCalls: new Map(),
        finishReason: null
      }

      const delta = choice.delta ?? {}
      if (typeof delta.role === 'string' && delta.role !== '') {
        state.role = delta.role
      }
      if (delta.content != null) {
        state.content = appendStreamText(state.content, delta.content)
      }
      if (Array.isArray(delta.annotations) && delta.annotations.length > 0) {
        state.annotations.push(...delta.annotations)
      }
      if (delta.thinking != null && typeof delta.thinking === 'object') {
        if (typeof delta.thinking.content === 'string') {
          state.thinking.content = `${state.thinking.content ?? ''}${delta.thinking.content}`
        }
        if (typeof delta.thinking.signature === 'string' && delta.thinking.signature !== '') {
          state.thinking.signature = delta.thinking.signature
        }
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const toolCallDelta of delta.tool_calls) {
          const toolIndex = toolCallDelta.index ?? 0
          const toolState = state.toolCalls.get(toolIndex) ?? {
            index: toolIndex,
            id: undefined,
            type: undefined,
            function: {
              name: undefined,
              arguments: ''
            }
          }

          if (typeof toolCallDelta.id === 'string' && toolCallDelta.id !== '') {
            toolState.id = toolCallDelta.id
          }
          if (typeof toolCallDelta.type === 'string' && toolCallDelta.type !== '') {
            toolState.type = toolCallDelta.type
          }
          if (toolCallDelta.function != null && typeof toolCallDelta.function === 'object') {
            if (
              typeof toolCallDelta.function.name === 'string' &&
              toolCallDelta.function.name !== ''
            ) {
              toolState.function.name = toolCallDelta.function.name
            }
            if (
              typeof toolCallDelta.function.arguments === 'string' &&
              toolCallDelta.function.arguments !== ''
            ) {
              toolState.function.arguments = `${toolState.function.arguments}${toolCallDelta.function.arguments}`
            }
          }

          state.toolCalls.set(toolIndex, toolState)
        }
      }
      if (choice.finish_reason != null) {
        state.finishReason = choice.finish_reason
      }

      choices.set(choice.index, state)
    }
  }

  return {
    type: 'chat.completion.chunk',
    choices: Array.from(choices.values())
      .sort((left, right) => left.index - right.index)
      .map((choice) => {
        const resolvedChoice = {
          index: choice.index,
          role: choice.role ?? 'assistant',
          finishReason: choice.finishReason
        }

        if (
          choice.content != null &&
          (
            (typeof choice.content === 'string' && choice.content !== '') ||
            (Array.isArray(choice.content) && choice.content.length > 0)
          )
        ) {
          resolvedChoice.content = choice.content
        }

        if (
          choice.thinking.content != null ||
          choice.thinking.signature != null
        ) {
          resolvedChoice.thinking = choice.thinking
        }
        if (choice.annotations.length > 0) {
          resolvedChoice.annotations = choice.annotations
        }
        if (choice.toolCalls.size > 0) {
          resolvedChoice.toolCalls = Array.from(choice.toolCalls.values())
            .sort((left, right) => left.index - right.index)
        }

        return resolvedChoice
      })
  }
}

const parseEventStreamDebugBody = (bodyText) => {
  const events = parseEventStreamEvents(bodyText)
  const assembled = assembleChatCompletionStream(events)
  const doneFromChoices = assembled?.choices?.some(choice => choice.finishReason != null) ?? false

  return {
    type: 'event-stream',
    eventCount: events.length,
    done: events.some(event => event.type === 'done') || doneFromChoices,
    ...(assembled != null
      ? { assembled }
      : {
        events: events.map((event) => ({
          ...(event.event != null ? { event: event.event } : {}),
          type: event.type,
          data: event.data
        }))
      })
  }
}

const createResponseDebugPayload = async (response) => {
  if (response == null || typeof response !== 'object') {
    return response
  }

  const contentType = typeof response.headers?.get === 'function'
    ? response.headers.get('Content-Type') ?? ''
    : ''
  const payload = {
    status: response.status,
    statusText: response.statusText,
    headers: typeof response.headers?.entries === 'function'
      ? Object.fromEntries(response.headers.entries())
      : {}
  }

  if (typeof response.clone !== 'function' || typeof response.body === 'undefined') {
    return payload
  }

  try {
    const bodyText = await response.clone().text()
    return {
      ...payload,
      body: parseResponseDebugBody(bodyText, contentType)
    }
  } catch (error) {
    return {
      ...payload,
      bodyReadError: error instanceof Error ? error.message : String(error)
    }
  }
}

export const writeResponseDebugLog = async (fileName, message, response, context, request) => {
  try {
    const payload = await createResponseDebugPayload(response)
    writeRequestDebugLog(fileName, message, payload, context, request)
  } catch (error) {
    writeRequestDebugLog(
      fileName,
      `${message} [response log error]`,
      { error: error instanceof Error ? error.message : String(error) },
      context,
      request
    )
  }
}
