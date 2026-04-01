const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const CCR_REQUEST_LOG_CONTEXT_TAG = 'VF-CCR-LOG-CONTEXT'
const CCR_REQUEST_LOG_CONTEXT_RE = new RegExp(
  `<${CCR_REQUEST_LOG_CONTEXT_TAG}>([A-Za-z0-9_-]+)</${CCR_REQUEST_LOG_CONTEXT_TAG}>\\n?`,
  'g'
)

const isTextObject = (value) =>
  value != null &&
  typeof value === 'object' &&
  typeof value.text === 'string'

const collectTextTargets = (request) => {
  const targets = []

  const pushTarget = (container, key) => {
    if (container == null) return

    const value = container[key]
    if (typeof value === 'string') {
      targets.push({ container, key })
      return
    }

    if (isTextObject(value)) {
      targets.push({ container: value, key: 'text' })
      return
    }

    if (!Array.isArray(value)) return

    value.forEach((item, index) => {
      if (typeof item === 'string') {
        targets.push({ container: value, key: index })
        return
      }

      if (isTextObject(item)) {
        targets.push({ container: item, key: 'text' })
      }
    })
  }

  pushTarget(request, 'instructions')
  pushTarget(request, 'system')

  if (Array.isArray(request?.messages)) {
    request.messages.forEach((message) => {
      if (message?.role !== 'system') return
      pushTarget(message, 'content')
    })
  }

  if (Array.isArray(request?.input)) {
    request.input.forEach((entry) => {
      if (entry?.role !== 'system') return
      pushTarget(entry, 'content')
    })
  }

  return targets
}

const parseRequestLogContext = (text) => {
  if (typeof text !== 'string') return undefined

  for (const match of text.matchAll(CCR_REQUEST_LOG_CONTEXT_RE)) {
    try {
      const parsed = JSON.parse(
        Buffer.from(match[1], 'base64url').toString('utf8')
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
  }

  return undefined
}

const resolveRequestLogContext = (context, request) => {
  const req = context?.req

  if (req?.vfLogContext) {
    return req.vfLogContext
  }

  const source = request ?? req?.body
  if (source == null) return undefined

  for (const target of collectTextTargets(source)) {
    const parsed = parseRequestLogContext(target.container[target.key])
    if (!parsed) continue

    if (req != null) {
      req.vfLogContext = parsed
      if (typeof req.sessionId !== 'string' || req.sessionId === '') {
        req.sessionId = parsed.sessionId
      }
    }

    return parsed
  }

  return undefined
}

const stripRequestLogContextMarker = (request, context) => {
  resolveRequestLogContext(context, request)

  collectTextTargets(request).forEach(({ container, key }) => {
    const value = container[key]
    if (typeof value !== 'string') return
    container[key] = value.replace(CCR_REQUEST_LOG_CONTEXT_RE, '')
  })

  return request
}

const resolveRequestLogPath = (fileName, context, request) => {
  const logContext = resolveRequestLogContext(context, request)
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
    return path.join(__dirname, 'temp.log.md')
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

const writeRequestDebugLog = (fileName, message, data = null, context, request) => {
  const timestamp = new Date().toISOString()
  try {
    const logMessage = data
      ? `# [${timestamp}] ${message}:\n` +
        '```json\n' +
        `${JSON.stringify(data, null, 2)}\n` +
        '```\n'
      : `# [${timestamp}] ${message}\n`
    const logPath = resolveRequestLogPath(fileName, context, request)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.appendFileSync(logPath, logMessage)
  } catch (error) {
    fs.appendFileSync(
      path.join(__dirname, 'temp.log.md'),
      `# [${timestamp}] ${error}\n`
    )
  }
}

module.exports = {
  resolveRequestLogContext,
  stripRequestLogContextMarker,
  writeRequestDebugLog
}
