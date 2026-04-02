// @ts-nocheck
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { formatLoggerEntry } from '@vibe-forge/utils'

const CLAUDE_CODE_SESSION_HEADER = 'x-claude-code-session-id'
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

const resolveCCRRequestLogContextPath = (workspace, sessionId) =>
  path.join(
    workspace,
    '.ai',
    '.mock',
    '.claude-code-router',
    'request-log-context',
    `${sessionId}.json`
  )

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
    workspace,
    '.ai',
    'logs',
    ctxId,
    sessionId,
    'adapter-claude-code',
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
