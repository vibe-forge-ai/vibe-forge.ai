import { Buffer } from 'node:buffer'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { LogLevel, Logger } from '@vibe-forge/types'

export type { Logger } from '@vibe-forge/types'

type YamlLogValue =
  | null
  | boolean
  | number
  | string
  | YamlLogValue[]
  | { [key: string]: YamlLogValue }

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

const YAML_INDENT = '  '
const YAML_RESERVED_PATTERN =
  /^(?:[-+]?\.inf|\.nan|[-+]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[-+]?\d+)?|true|false|null|[~yn]|yes|no|on|off)$/i
const MARKDOWN_FENCE_LINE_PATTERN = /(^|\n)([ \t]{0,3})```/g

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  Object.getPrototypeOf(value) === Object.prototype
)

const hasToJSON = (value: object): value is object & { toJSON: () => unknown } => (
  typeof (value as { toJSON?: unknown }).toJSON === 'function'
)

const isMultilineString = (value: string) => value.includes('\n') || value.includes('\r')

const canUsePlainYamlString = (value: string) => (
  value.length > 0 &&
  value.trim() === value &&
  !isMultilineString(value) &&
  !YAML_RESERVED_PATTERN.test(value) &&
  !/^[\-?:,![\]{}#&*|>'"%@`]/.test(value) &&
  !/[:#[\]{},]/.test(value)
)

const formatYamlString = (value: string) => (
  canUsePlainYamlString(value)
    ? value
    : JSON.stringify(value)
)

const formatYamlInlineValue = (value: YamlLogValue): string => {
  if (value == null) return 'null'
  if (typeof value === 'string') return formatYamlString(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : JSON.stringify(String(value))
  if (typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return '[]'
  return '{}'
}

const normalizeMultilineString = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

const escapeMarkdownFenceLines = (value: string) => (
  value.replace(
    MARKDOWN_FENCE_LINE_PATTERN,
    (_match, lineStart: string, indent: string) => `${lineStart}${indent}\\\`\\\`\\\``
  )
)

const formatMultilineLogString = (value: string) => escapeMarkdownFenceLines(normalizeMultilineString(value))

const toYamlLogValue = (value: unknown, stack = new WeakSet<object>()): YamlLogValue => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol') return String(value)
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`

  if (value instanceof Date) return value.toISOString()
  if (value instanceof RegExp) return value.toString()
  if (Buffer.isBuffer(value)) {
    return {
      type: 'Buffer',
      data: Array.from(value.values())
    }
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }
  if (value instanceof Map) {
    if (stack.has(value)) return '[Circular]'
    stack.add(value)
    const result = Object.fromEntries(
      Array.from(value.entries()).map(([key, entryValue]) => [String(key), toYamlLogValue(entryValue, stack)])
    )
    stack.delete(value)
    return result
  }
  if (value instanceof Set) {
    if (stack.has(value)) return '[Circular]'
    stack.add(value)
    const result = Array.from(value.values()).map(item => toYamlLogValue(item, stack))
    stack.delete(value)
    return result
  }
  if (Array.isArray(value)) {
    if (stack.has(value)) return '[Circular]'
    stack.add(value)
    const result = value.map(item => toYamlLogValue(item, stack))
    stack.delete(value)
    return result
  }
  if (typeof value === 'object' && hasToJSON(value)) {
    if (stack.has(value)) return '[Circular]'
    stack.add(value)
    const result = toYamlLogValue(value.toJSON(), stack)
    stack.delete(value)
    return result
  }
  if (!isPlainObject(value)) return String(value)
  if (stack.has(value)) return '[Circular]'
  stack.add(value)
  const result = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, toYamlLogValue(entryValue, stack)])
  )
  stack.delete(value)
  return result
}

const formatYamlKey = (key: string) => (
  canUsePlainYamlString(key)
    ? key
    : JSON.stringify(key)
)

const isYamlInlineValue = (value: YamlLogValue) => (
  value == null ||
  typeof value === 'boolean' ||
  typeof value === 'number' ||
  (typeof value === 'string' && !isMultilineString(value)) ||
  (Array.isArray(value) && value.length === 0) ||
  (isPlainObject(value) && Object.keys(value).length === 0)
)

const renderYamlMultilineString = (value: string, indentLevel: number): string[] => {
  const indent = YAML_INDENT.repeat(indentLevel)
  const childIndent = YAML_INDENT.repeat(indentLevel + 1)
  return [
    `${indent}>-`,
    ...formatMultilineLogString(value)
      .split('\n')
      .map(line => `${childIndent}${line}`)
  ]
}

const renderYamlLines = (value: YamlLogValue, indentLevel = 0): string[] => {
  const indent = YAML_INDENT.repeat(indentLevel)
  if (typeof value === 'string' && isMultilineString(value)) {
    return renderYamlMultilineString(value, indentLevel)
  }
  if (isYamlInlineValue(value)) {
    return [`${indent}${formatYamlInlineValue(value)}`]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && isMultilineString(item)) {
        return [
          `${indent}- >-`,
          ...formatMultilineLogString(item)
            .split('\n')
            .map(line => `${YAML_INDENT.repeat(indentLevel + 1)}${line}`)
        ]
      }
      if (isYamlInlineValue(item)) {
        return [`${indent}- ${formatYamlInlineValue(item)}`]
      }
      if (Array.isArray(item)) {
        return [
          `${indent}-`,
          ...renderYamlLines(item, indentLevel + 1)
        ]
      }

      const [firstLine, ...restLines] = renderYamlLines(item, indentLevel + 1)
      const childIndent = YAML_INDENT.repeat(indentLevel + 1)
      return [
        `${indent}- ${firstLine.slice(childIndent.length)}`,
        ...restLines
      ]
    })
  }

  return Object.entries(value as Record<string, YamlLogValue>)
    .flatMap(([key, entryValue]) => {
      const renderedKey = formatYamlKey(key)
      if (typeof entryValue === 'string' && isMultilineString(entryValue)) {
        return [
          `${indent}${renderedKey}: >-`,
          ...formatMultilineLogString(entryValue)
            .split('\n')
            .map(line => `${YAML_INDENT.repeat(indentLevel + 1)}${line}`)
        ]
      }
      if (isYamlInlineValue(entryValue)) {
        return [`${indent}${renderedKey}: ${formatYamlInlineValue(entryValue)}`]
      }
      return [
        `${indent}${renderedKey}:`,
        ...renderYamlLines(entryValue, indentLevel + 1)
      ]
    })
}

const formatStructuredLogValue = (value: unknown) => (
  renderYamlLines(toYamlLogValue(value)).join('\n')
)

export const formatLoggerMessage = (...args: unknown[]) => (
  args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg
      }
      if (arg instanceof Error) {
        const errorText = formatMultilineLogString(arg.stack ?? String(arg))
        return (
          '\n```text\n' +
          `${errorText}\n` +
          '```'
        )
      }
      return (
        '\n```yaml\n' +
        `${formatStructuredLogValue(arg)}\n` +
        '```'
      )
    })
    .join(' ')
)

export const formatLoggerEntry = (
  tag: string,
  args: unknown[],
  now = new Date().toLocaleString()
) => (
  `# [${now}] __${tag}__ ${formatLoggerMessage(...args)}\n`
)

export const createLogger = (
  cwd: string,
  taskId: string,
  sessionId: string,
  logPrefix = '',
  level: LogLevel = 'info'
): Logger => {
  const normalizedSessionId = sessionId ?? 'default'
  const taskDir = resolve(
    cwd,
    `.ai${logPrefix}/logs/${taskId}`
  )

  const loggerFilePath = resolve(
    taskDir,
    `${normalizedSessionId}.log.md`
  )
  // 默认日志文件不存在时，创建一个默认的日志文件
  if (!existsSync(loggerFilePath)) {
    mkdirSync(dirname(loggerFilePath), { recursive: true })
  }
  const loggerStream = createWriteStream(loggerFilePath, {
    flags: 'a'
  })
  const createLog = (tag: string, currentLevel: LogLevel) => (...args: unknown[]) => {
    if (LOG_LEVEL_PRIORITY[currentLevel] < LOG_LEVEL_PRIORITY[level]) {
      return
    }
    const now = new Date().toLocaleString()
    if (loggerStream.writableEnded) {
      const tempLoggerStream = createWriteStream(loggerFilePath, {
        flags: 'a'
      })
      tempLoggerStream.write(formatLoggerEntry('E', ['UNEXPECTED LOGGER STREAM ENDED'], now))
      tempLoggerStream.write(formatLoggerEntry(tag, args, now))
      tempLoggerStream.end()
      return
    }
    loggerStream.write(formatLoggerEntry(tag, args, now))
  }
  return {
    stream: loggerStream,
    info: createLog('I', 'info'),
    warn: createLog('W', 'warn'),
    debug: createLog('D', 'debug'),
    error: createLog('E', 'error')
  }
}
