import path from 'node:path'

import { parseHookLogEntries } from './log'
import { repoRoot } from './runtime'
import type { AdapterE2EResult } from './types'

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

const sanitizeValue = (value: string) => (
  value
    .replaceAll(repoRoot, '<repo>')
    .replace(uuidPattern, '<uuid>')
    .replace(/hooks-smoke-[\w-]+-\d+/g, '<ctxId>')
    .replace(/\.tmp-\d+/g, '.tmp-<nonce>')
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, 'http://127.0.0.1:<port>')
    .replace(/hook-smoke-local/g, '<mock-api-key>')
    .replace(/\b(?:ses|msg|prt|call|resp|chatcmpl)_[\w-]+\b/g, '<id>')
    .replace(/\/Users\/[^/\n]+/g, '<user-home>')
)

const normalizeTextBlock = (value: string) => (
  sanitizeValue(
    value
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim()
  )
)

const summarizeText = (value: string, maxChars = 180) => {
  const normalized = normalizeTextBlock(value)
  if (normalized === '') return normalized

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const highlighted = [...lines].reverse().find((line) => (
    /Generate a title|README\.md|reply with exactly|Use the|Use a tool first|E2E_/i.test(line)
  )) ?? lines.at(-1) ?? normalized

  return highlighted.length > maxChars
    ? `${highlighted.slice(0, maxChars)}...`
    : highlighted
}

const summarizeContent = (value: string, maxLines = 24) => {
  const normalized = normalizeTextBlock(value)
  if (normalized === '') return normalized

  const lines = normalized.split('\n')
  if (lines.length <= maxLines) return normalized

  return [
    ...lines.slice(0, maxLines),
    `... (${lines.length - maxLines} more lines)`
  ].join('\n')
}

const sanitizeUnknown = (value: unknown): unknown => {
  if (typeof value === 'string') return sanitizeValue(value)
  if (Array.isArray(value)) return value.map(item => sanitizeUnknown(item))
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sanitizeUnknown(item)])
    )
  }
  return value
}

const compactObject = <T extends Record<string, unknown>>(value: T) => (
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => (
      entry !== undefined &&
      entry !== '' &&
      (!Array.isArray(entry) || entry.length > 0)
    ))
  )
)

const readNested = (
  payload: Record<string, unknown>,
  pathKeys: string[]
) => {
  let current: unknown = payload
  for (const key of pathKeys) {
    if (current == null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const pickNestedString = (
  payload: Record<string, unknown>,
  candidates: Array<string[]>
) => {
  for (const pathKeys of candidates) {
    const current = readNested(payload, pathKeys)
    if (typeof current === 'string' && current.trim() !== '') {
      return sanitizeValue(current)
    }
  }
  return undefined
}

const pickNestedBoolean = (
  payload: Record<string, unknown>,
  candidates: Array<string[]>
) => {
  for (const pathKeys of candidates) {
    const current = readNested(payload, pathKeys)
    if (typeof current === 'boolean') {
      return current
    }
  }
  return undefined
}

const inferToolNameFromHeader = (
  headerText: string | undefined,
  adapter: string | undefined
) => {
  if (headerText == null) return undefined

  const normalized = sanitizeValue(headerText).trim()
  if (normalized === '') return undefined

  if (adapter != null && normalized.startsWith(`${adapter} `)) {
    return normalized.slice(adapter.length + 1).trim() || undefined
  }

  const knownAdapterPrefix = ['codex', 'claude-code', 'opencode']
    .find(prefix => normalized.startsWith(`${prefix} `))
  if (knownAdapterPrefix != null) {
    return normalized.slice(knownAdapterPrefix.length + 1).trim() || undefined
  }

  return normalized
}

const summarizeLog = (content: string) => {
  return parseHookLogEntries(content).map((entry) => {
    const adapter = pickNestedString(entry.payload, [['adapter']])
    const toolName = pickNestedString(entry.payload, [
      ['toolName'],
      ['tool', 'name'],
      ['data', 'toolName'],
      ['data', 'tool', 'name'],
      ['input', 'toolName']
    ]) ?? inferToolNameFromHeader(entry.headerText, adapter)

    const detail = (() => {
      const fromPayload = pickNestedString(entry.payload, [
        ['command'],
        ['toolInput', 'command'],
        ['args', 'command'],
        ['resp', 'title'],
        ['data', 'message']
      ])
      if (fromPayload != null) return summarizeText(fromPayload)
      if (entry.textBlock != null) return summarizeText(entry.textBlock)
      return undefined
    })()

    return compactObject({
      event: entry.eventName,
      adapter,
      hookSource: pickNestedString(entry.payload, [['hookSource']]),
      canBlock: typeof entry.payload.canBlock === 'boolean' ? entry.payload.canBlock : undefined,
      prompt: (() => {
        const prompt = pickNestedString(entry.payload, [['prompt'], ['data', 'prompt']])
        return prompt == null ? undefined : summarizeText(prompt)
      })(),
      header: entry.headerText == null ? undefined : sanitizeValue(entry.headerText),
      toolName,
      detail,
      redacted: pickNestedBoolean(entry.payload, [
        ['options', 'env', 'redacted'],
        ['env', 'redacted'],
        ['data', 'env', 'redacted']
      ])
    })
  })
}

const summarizeStdout = (stdout: string) => {
  const normalized = normalizeTextBlock(stdout)
  if (normalized === '') return normalized

  const lines = normalized.split('\n').filter(Boolean)
  const parsed = lines.map((line) => {
    try {
      return JSON.parse(line) as Record<string, unknown>
    } catch {
      return undefined
    }
  })

  if (parsed.every(item => item != null)) {
    return parsed.map((item) => {
      const part = item?.part
      const partObject = (
          part != null &&
          typeof part === 'object' &&
          !Array.isArray(part)
        )
        ? part as Record<string, unknown>
        : {}
      const state = (
          partObject.state != null &&
          typeof partObject.state === 'object' &&
          !Array.isArray(partObject.state)
        )
        ? partObject.state as Record<string, unknown>
        : {}

      return compactObject({
        type: item?.type,
        partType: partObject.type,
        reason: partObject.reason,
        text: typeof partObject.text === 'string' ? summarizeText(partObject.text) : undefined,
        tool: typeof partObject.tool === 'string' ? partObject.tool : undefined,
        status: state.status,
        input: state.input == null ? undefined : sanitizeUnknown(state.input)
      })
    })
  }

  return summarizeText(normalized, 240)
}

const summarizeStderr = (stderr: string) => {
  const normalized = normalizeTextBlock(stderr)
  if (normalized === '') return normalized

  const lines = normalized
    .split('\n')
    .map((line) =>
      line
        .replace(/^\d{4}-\d{2}-\d{2}T\S+\s+/, '')
        .replace(/^INFO\s+\d{4}-\d{2}-\d{2}T\S+\s+\+\d+ms\s+/, 'INFO ')
        .replace(/^WARN\s+\d{4}-\d{2}-\d{2}T\S+\s+\+\d+ms\s+/, 'WARN ')
        .replace(/^ERROR\s+\d{4}-\d{2}-\d{2}T\S+\s+\+\d+ms\s+/, 'ERROR ')
        .trim()
    )
  const filteredLines: string[] = []
  let droppingHtmlNoise = false

  for (const line of lines) {
    if (line === '') continue
    if (line.includes('service=bun cmd=') || line.includes('service=bun code=')) continue

    const isStructuredLogLine = /^(?:INFO|WARN|ERROR)\s/.test(line)
    if (line.includes('failed to warm featured plugin ids cache')) {
      droppingHtmlNoise = true
      continue
    }

    if (droppingHtmlNoise) {
      if (!isStructuredLogLine) {
        continue
      }
      droppingHtmlNoise = false
    }

    if (/^<\/?(?:html|head|body|meta|style|div|svg|path)\b/i.test(line)) {
      continue
    }
    if (/^[a-z]+="[^"]*"$/i.test(line)) {
      continue
    }
    if (line === '>' || line === '/>') {
      continue
    }

    filteredLines.push(line)
  }

  const unique: string[] = []
  for (const line of filteredLines) {
    if (!unique.includes(line)) {
      unique.push(line)
    }
  }

  return unique.length > 12
    ? [...unique.slice(0, 12), '... (truncated)']
    : unique
}

export const createAdapterE2ESnapshot = (result: AdapterE2EResult) => ({
  caseId: result.caseId,
  adapter: result.adapter,
  transport: result.transport,
  exitCode: result.exitCode,
  stdout: summarizeStdout(result.stdout),
  stderr: summarizeStderr(result.stderr),
  mockTrace: result.mockTrace.map(entry => ({
    path: sanitizeValue(entry.path),
    model: sanitizeValue(entry.model),
    request: summarizeText(entry.requestText),
    inputTypes: entry.inputTypes,
    requestedToolCount: entry.requestedToolCount,
    selectedTool: entry.selectedTool == null
      ? undefined
      : {
        name: sanitizeValue(entry.selectedTool.name),
        args: sanitizeUnknown(entry.selectedTool.args)
      },
    response: entry.response.kind === 'tool'
      ? {
        kind: 'tool',
        tool: {
          name: sanitizeValue(entry.response.tool.name),
          args: sanitizeUnknown(entry.response.tool.args)
        }
      }
      : {
        kind: 'message',
        text: summarizeText(entry.response.text)
      }
  })),
  log: {
    path: sanitizeValue(path.relative(repoRoot, result.logPath)),
    entries: summarizeLog(result.logContent)
  },
  artifacts: result.managedArtifacts.map(artifact => ({
    label: artifact.label,
    path: sanitizeValue(path.relative(repoRoot, artifact.path)),
    content: summarizeContent(artifact.content)
  }))
})

export const serializeAdapterE2ESnapshot = (result: AdapterE2EResult) => (
  `${JSON.stringify(createAdapterE2ESnapshot(result), null, 2)}\n`
)
