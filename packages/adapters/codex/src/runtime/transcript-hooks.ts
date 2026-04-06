import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { callHook } from '@vibe-forge/hooks'
import type { AdapterCtx, TaskRuntime } from '@vibe-forge/types'

interface CodexTranscriptEvent {
  timestamp?: string
  type?: string
  payload?: Record<string, unknown>
}

interface CodexTranscriptSessionMeta {
  id?: string
  cwd?: string
  timestamp?: string
}

interface TranscriptFileState {
  byteOffset: number
  remainder: string
  sessionMeta?: CodexTranscriptSessionMeta & { eligible: boolean }
}

interface PendingTranscriptToolCall {
  toolName: string
  toolInput?: unknown
  transcriptPath: string
}

interface CodexTranscriptHookWatcherParams {
  cwd: string
  env: AdapterCtx['env']
  homeDir?: string
  logger: AdapterCtx['logger']
  runtime: TaskRuntime
  sessionId: string
  pollIntervalMs?: number
}

export interface CodexTranscriptHookWatcher {
  start(): void
  stop(): void
}

const DEFAULT_POLL_INTERVAL_MS = 250
const SESSION_TIME_SKEW_MS = 5_000

const BASH_LIKE_TOOL_NAMES = new Set([
  'bash',
  'exec',
  'exec_command',
  'command_execution',
  'shell',
  'local_shell'
])

const TOOL_NAME_MAP: Record<string, string> = {
  apply_patch: 'adapter:codex:ApplyPatch',
  edit_file: 'adapter:codex:EditFile',
  glob: 'adapter:codex:Glob',
  grep: 'adapter:codex:Grep',
  list_dir: 'adapter:codex:ListDir',
  read: 'adapter:codex:ReadFile',
  read_file: 'adapter:codex:ReadFile',
  view_image: 'adapter:codex:ViewImage',
  web_fetch: 'adapter:codex:WebFetch',
  write_file: 'adapter:codex:WriteFile'
}

const parseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const readString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
)

const readRecord = (value: unknown) => (
  isRecord(value) ? value : undefined
)

const readCallId = (payload: Record<string, unknown>) => (
  readString(payload.call_id) ??
  readString(payload.callId) ??
  readString(payload.id)
)

const buildMcpToolName = (payload: Record<string, unknown>) => {
  const serverName = readString(payload.server) ?? readString(payload.server_name)
  const toolName = readString(payload.tool) ?? readString(payload.tool_name) ?? readString(payload.name)
  if (serverName == null || toolName == null) return undefined
  return `mcp:${serverName}:${toolName}`
}

const isImmediateToolPayload = (payloadType: string) => (
  payloadType === 'web_search_call' ||
  payloadType === 'file_change'
)

const isPendingToolCallPayload = (payloadType: string) => (
  payloadType === 'function_call' ||
  payloadType === 'custom_tool_call' ||
  payloadType === 'mcp_tool_call'
)

const isPendingToolResultPayload = (payloadType: string) => (
  payloadType === 'function_call_output' ||
  payloadType === 'custom_tool_call_output' ||
  payloadType === 'mcp_tool_call_output'
)

const normalizeToolName = (
  rawName: string | undefined,
  payloadType: string,
  payload?: Record<string, unknown>
) => {
  if (payloadType === 'web_search_call') return 'adapter:codex:WebSearch'
  if (payloadType === 'file_change') return 'adapter:codex:FileChange'

  if (payloadType === 'mcp_tool_call' && payload != null) {
    rawName = buildMcpToolName(payload)
  }

  if (rawName == null || rawName.trim() === '') return undefined

  const normalizedRawName = rawName.trim()
  const normalizedKey = normalizedRawName.toLowerCase()

  if (BASH_LIKE_TOOL_NAMES.has(normalizedKey)) return undefined
  if (TOOL_NAME_MAP[normalizedKey] != null) return TOOL_NAME_MAP[normalizedKey]
  if (normalizedRawName.startsWith('adapter:codex:')) return normalizedRawName

  return `adapter:codex:${normalizedRawName}`
}

const extractToolInput = (payloadType: string, payload: Record<string, unknown>) => {
  if (payloadType === 'web_search_call') {
    const action = isRecord(payload.action) ? payload.action : {}
    const actionType = typeof action.type === 'string' ? action.type : undefined

    if (actionType === 'search') {
      return { query: action.query ?? payload.query }
    }
    if (actionType === 'open_page') {
      return { url: action.url }
    }
    if (actionType === 'find_in_page') {
      return {
        url: action.url,
        pattern: action.pattern
      }
    }
    return action
  }

  if (payloadType === 'function_call') {
    if (typeof payload.arguments === 'string') {
      return parseJson(payload.arguments) ?? { raw: payload.arguments }
    }
    return readRecord(payload.arguments)
  }

  if (payloadType === 'custom_tool_call') {
    if (typeof payload.input !== 'string') return undefined
    if (typeof payload.name === 'string' && payload.name.trim().toLowerCase() === 'apply_patch') {
      return { patch: payload.input }
    }
    return parseJson(payload.input) ?? { input: payload.input }
  }

  if (payloadType === 'mcp_tool_call') {
    if (typeof payload.arguments === 'string') {
      return parseJson(payload.arguments) ?? { raw: payload.arguments }
    }

    return readRecord(payload.arguments) ??
      readRecord(payload.input) ??
      {
        server: readString(payload.server) ?? readString(payload.server_name),
        tool: readString(payload.tool) ?? readString(payload.tool_name) ?? readString(payload.name)
      }
  }

  if (payloadType === 'file_change') {
    return {
      status: payload.status,
      changes: Array.isArray(payload.changes) ? payload.changes : []
    }
  }

  return undefined
}

const extractToolResponse = (payloadType: string, payload: Record<string, unknown>) => {
  if (payloadType === 'web_search_call') {
    return {
      status: payload.status,
      action: payload.action
    }
  }

  if (payloadType === 'file_change') {
    return {
      status: payload.status,
      changes: Array.isArray(payload.changes) ? payload.changes : []
    }
  }

  if (isPendingToolResultPayload(payloadType)) {
    if (typeof payload.output !== 'string') return payload.output
    return parseJson(payload.output) ?? payload.output
  }

  return undefined
}

const extractToolError = (toolResponse: unknown) => {
  if (!isRecord(toolResponse)) return false
  if (toolResponse.success === false) return true
  if (typeof toolResponse.status === 'string') {
    return toolResponse.status === 'failed' || toolResponse.status === 'declined'
  }
  if (isRecord(toolResponse.metadata) && typeof toolResponse.metadata.exit_code === 'number') {
    return toolResponse.metadata.exit_code !== 0
  }
  if (isRecord(toolResponse.metadata) && typeof toolResponse.metadata.exitCode === 'number') {
    return toolResponse.metadata.exitCode !== 0
  }
  return false
}

const walkJsonlFiles = (dir: string, visit: (filePath: string) => void) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      walkJsonlFiles(fullPath, visit)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      visit(fullPath)
    }
  }
}

const parseTranscriptLine = (line: string) => {
  try {
    return JSON.parse(line) as CodexTranscriptEvent
  } catch {
    return undefined
  }
}

class CodexTranscriptHookWatcherImpl implements CodexTranscriptHookWatcher {
  private readonly states = new Map<string, TranscriptFileState>()
  private readonly pendingCalls = new Map<string, PendingTranscriptToolCall>()
  private readonly startedAt = Date.now()
  private readonly sessionsDir: string
  private timer: NodeJS.Timeout | undefined
  private stopped = false

  constructor(private readonly params: CodexTranscriptHookWatcherParams) {
    const homeDir = params.homeDir ?? params.env.HOME ?? process.env.HOME
    this.sessionsDir = resolve(homeDir ?? '/', '.codex', 'sessions')
  }

  start() {
    try {
      this.scanSessionsDir()
      void this.scanForChanges()
      this.timer = setInterval(() => {
        void this.scanForChanges()
      }, this.params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    } catch (error) {
      this.params.logger.warn('[codex transcript hooks] failed to start watcher', error)
    }
  }

  stop() {
    this.stopped = true
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    this.states.clear()
    this.pendingCalls.clear()
  }

  private scanSessionsDir() {
    try {
      if (!existsSync(this.sessionsDir)) return
      walkJsonlFiles(this.sessionsDir, (filePath) => {
        if (this.states.has(filePath)) return
        const size = statSync(filePath).size
        this.states.set(filePath, { byteOffset: size, remainder: '' })
      })
    } catch {
      // sessions dir may not exist until codex writes the first transcript
    }
  }

  private async scanForChanges() {
    if (this.stopped) return

    try {
      if (!existsSync(this.sessionsDir)) return
      walkJsonlFiles(this.sessionsDir, (filePath) => {
        const stat = statSync(filePath)
        const current = this.states.get(filePath)

        if (current == null) {
          this.states.set(filePath, { byteOffset: 0, remainder: '' })
          void this.processFile(filePath)
          return
        }

        if (stat.size < current.byteOffset) {
          current.byteOffset = 0
          current.remainder = ''
          current.sessionMeta = undefined
        }

        if (stat.size > current.byteOffset) {
          void this.processFile(filePath)
        }
      })
    } catch (error) {
      this.params.logger.warn('[codex transcript hooks] failed to scan session transcripts', error)
    }
  }

  private async processFile(filePath: string) {
    const state = this.states.get(filePath) ?? { byteOffset: 0, remainder: '' }
    this.states.set(filePath, state)

    let fd: number | undefined

    try {
      const stat = statSync(filePath)
      if (stat.size <= state.byteOffset) return

      fd = openSync(filePath, 'r')
      const nextLength = stat.size - state.byteOffset
      const buffer = Buffer.alloc(nextLength)
      readSync(fd, buffer, 0, nextLength, state.byteOffset)
      state.byteOffset = stat.size

      const chunk = `${state.remainder}${buffer.toString('utf8')}`
      const lines = chunk.split('\n')
      state.remainder = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        const event = parseTranscriptLine(trimmed)
        if (event == null) continue
        await this.handleEvent(filePath, state, event)
      }
    } catch (error) {
      this.params.logger.warn('[codex transcript hooks] failed to process transcript file', { error, filePath })
    } finally {
      if (fd != null) {
        closeSync(fd)
      }
    }
  }

  private async handleEvent(
    filePath: string,
    state: TranscriptFileState,
    event: CodexTranscriptEvent
  ) {
    const payload = isRecord(event.payload) ? event.payload : undefined
    if (payload == null) return

    if (event.type === 'session_meta') {
      const sessionMeta = payload as CodexTranscriptSessionMeta
      const sessionTimestamp = Date.parse(sessionMeta.timestamp ?? event.timestamp ?? '')
      state.sessionMeta = {
        ...sessionMeta,
        eligible: sessionMeta.cwd === this.params.cwd &&
          (!Number.isFinite(sessionTimestamp) || sessionTimestamp >= this.startedAt - SESSION_TIME_SKEW_MS)
      }
      return
    }

    if (event.type !== 'response_item' || state.sessionMeta?.eligible !== true) return

    const payloadType = typeof payload.type === 'string' ? payload.type : undefined
    if (payloadType == null) return

    if (isImmediateToolPayload(payloadType)) {
      const toolName = normalizeToolName(undefined, payloadType, payload)
      if (toolName == null) return

      const callId = readCallId(payload) ?? `${payloadType}:${event.timestamp ?? Date.now().toString(36)}:${state.byteOffset}`
      const toolInput = extractToolInput(payloadType, payload)
      const toolResponse = extractToolResponse(payloadType, payload)
      await this.callObservationalHook('PreToolUse', {
        transcriptPath: filePath,
        toolCallId: callId,
        toolInput,
        toolName
      })
      await this.callObservationalHook('PostToolUse', {
        transcriptPath: filePath,
        toolCallId: callId,
        toolInput,
        toolName,
        toolResponse,
        isError: extractToolError(toolResponse)
      })
      return
    }

    if (isPendingToolCallPayload(payloadType)) {
      const rawToolName = typeof payload.name === 'string'
        ? payload.name
        : typeof payload.tool === 'string'
          ? payload.tool
          : typeof payload.tool_name === 'string'
            ? payload.tool_name
            : undefined
      const toolName = normalizeToolName(rawToolName, payloadType, payload)
      const callId = readCallId(payload)
      if (toolName == null || callId == null) return

      const toolInput = extractToolInput(payloadType, payload)
      this.pendingCalls.set(callId, {
        toolName,
        toolInput,
        transcriptPath: filePath
      })
      await this.callObservationalHook('PreToolUse', {
        transcriptPath: filePath,
        toolCallId: callId,
        toolInput,
        toolName
      })
      return
    }

    if (isPendingToolResultPayload(payloadType)) {
      const callId = readCallId(payload)
      if (callId == null) return

      const pending = this.pendingCalls.get(callId)
      this.pendingCalls.delete(callId)
      if (pending == null) return

      const toolResponse = extractToolResponse(payloadType, payload)
      await this.callObservationalHook('PostToolUse', {
        transcriptPath: pending.transcriptPath,
        toolCallId: callId,
        toolInput: pending.toolInput,
        toolName: pending.toolName,
        toolResponse,
        isError: extractToolError(toolResponse)
      })
    }
  }

  private async callObservationalHook(
    eventName: 'PreToolUse' | 'PostToolUse',
    input: Record<string, unknown>
  ) {
    try {
      const output = await callHook(eventName, {
        adapter: 'codex',
        canBlock: false,
        cwd: this.params.cwd,
        hookSource: 'bridge',
        runtime: this.params.runtime,
        sessionId: this.params.sessionId,
        ...input
      } as any, this.params.env)

      if (output?.continue === false) {
        this.params.logger.warn(
          `[codex transcript hooks] ignoring blocking output from observational ${eventName} hook`,
          output.stopReason
        )
      }
    } catch (error) {
      this.params.logger.error(`[codex transcript hooks] ${eventName} failed`, error)
    }
  }
}

export const createCodexTranscriptHookWatcher = (params: CodexTranscriptHookWatcherParams) => (
  new CodexTranscriptHookWatcherImpl(params)
)
