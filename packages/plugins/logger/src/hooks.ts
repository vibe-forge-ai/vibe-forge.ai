import { definePlugin } from '@vibe-forge/hooks'

const asRecord = (value: unknown): Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
)

const REDACTED = '[REDACTED]'
const SENSITIVE_KEY_PATTERN = /api[-_]?key|token|secret|authorization|password|cookie|session[-_]?token|bearer/i
const MARKDOWN_FENCE_LINE_PATTERN = /(^|\n)([ \t]{0,3})```/g

const sanitizeEnvRecord = (value: unknown) => {
  const record = asRecord(value)
  return {
    redacted: true,
    count: Object.keys(record).length,
    keys: Object.keys(record).sort()
  }
}

const escapeMarkdownFenceLines = (value: string) => (
  value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(
      MARKDOWN_FENCE_LINE_PATTERN,
      (_match, lineStart: string, indent: string) => `${lineStart}${indent}\\\`\\\`\\\``
    )
)

const formatLogText = (value: unknown) => escapeMarkdownFenceLines(String(value ?? ''))

const sanitizeHookLogValue = (
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet()
): unknown => {
  if (key === 'env') return sanitizeEnvRecord(value)
  if (key != null && SENSITIVE_KEY_PATTERN.test(key)) return REDACTED

  if (Array.isArray(value)) {
    return value.map(item => sanitizeHookLogValue(item, undefined, seen))
  }

  if (value != null && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeHookLogValue(entryValue, entryKey, seen)
      ])
    )
  }

  return value
}

const logSanitizedInput = (
  logger: { info: (...args: unknown[]) => void },
  input: unknown
) => {
  logger.info(sanitizeHookLogValue(input))
}

export default definePlugin({
  name: 'logger',
  GenerateSystemPrompt: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  StartTasks: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  TaskStart: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  TaskStop: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  SessionStart: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  UserPromptSubmit: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  PreToolUse: ({ logger }, input, next) => {
    logger.info(
      input.adapter ?? 'unknown-adapter',
      input.toolName,
      sanitizeHookLogValue(input.toolInput, 'toolInput')
    )
    return next()
  },
  PostToolUse: ({ logger }, input, next) => {
    switch (input.toolName) {
      case 'Bash':
      case 'adapter:codex:Bash': {
        const toolInput = asRecord(sanitizeHookLogValue(input.toolInput, 'toolInput'))
        const toolResponse = asRecord(sanitizeHookLogValue(input.toolResponse, 'toolResponse'))
        const description = formatLogText(toolInput.description)
        const command = formatLogText(toolInput.command)
        const stdout = formatLogText(toolResponse.stdout ?? input.toolResponse ?? '<no stdout>')
        const stderr = formatLogText(toolResponse.stderr ?? '<no stderr>')
        logger.info(
          input.toolName,
          description,
          '\n```text\n' +
            `isImage: ${toolResponse.isImage ?? ''}\n` +
            `interrupted: ${toolResponse.interrupted ?? ''}\n` +
            `> ${command}\n\n` +
            `stdout: ${stdout}\n` +
            '-----------------------------------------\n' +
            `stderr: ${stderr}\n` +
            '\n```'
        )
        break
      }
      default:
        logger.info(input.toolName, {
          args: sanitizeHookLogValue(input.toolInput, 'toolInput'),
          resp: sanitizeHookLogValue(input.toolResponse ?? {}, 'toolResponse'),
          adapter: input.adapter,
          hookSource: input.hookSource
        })
    }
    return next()
  },
  Stop: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  SessionEnd: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  PreCompact: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  Notification: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  },
  SubagentStop: ({ logger }, input, next) => {
    logSanitizedInput(logger, input)
    return next()
  }
})
