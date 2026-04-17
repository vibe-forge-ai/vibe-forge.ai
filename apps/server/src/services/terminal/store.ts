import { WebSocket as WebSocketImpl } from 'ws'
import type { WebSocket } from 'ws'

import type { TerminalSessionEvent, TerminalSessionInfo, TerminalShellKind } from '@vibe-forge/types'

import { getWorkspaceFolder } from '#~/services/config/index.js'
import { safeJsonStringify } from '#~/utils/json.js'

import { normalizeTerminalId, resolveTerminalRuntimeKey } from './ids'
import { normalizeTerminalShellKind, resolveTerminalShell } from './shells'

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32
const MAX_COLS = 320
const MAX_ROWS = 120
const SCROLLBACK_CHAR_LIMIT = 200_000
const IDLE_TIMEOUT_MS = 60_000

export interface TerminalRuntime {
  sessionId: string
  terminalId: string
  shellKind: TerminalShellKind
  runtimeKey: string
  sockets: Set<WebSocket>
  info: TerminalSessionInfo
  scrollback: string
  started: boolean
  driver?: {
    kind: 'pty' | 'pipe'
    pid?: number
    write: (data: string) => void
    resize: (cols: number, rows: number) => void
    kill: () => void
  }
  idleTimer?: NodeJS.Timeout
}

export const terminalRuntimeStore = new Map<string, TerminalRuntime>()
export const getTerminalRuntime = (sessionId: string, terminalId?: string | null) => {
  return terminalRuntimeStore.get(resolveTerminalRuntimeKey(sessionId, terminalId))
}

export const normalizeDimension = (value: number | undefined, fallback: number, max: number) => {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  if (normalized < 2) {
    return fallback
  }

  return Math.min(normalized, max)
}

export const sendTerminalEvent = (socket: WebSocket, event: TerminalSessionEvent) => {
  if (socket.readyState !== WebSocketImpl.OPEN) {
    return
  }

  socket.send(safeJsonStringify(event))
}

export const closeTerminalSocket = (socket: WebSocket, code = 1000, reason?: string) => {
  if (socket.readyState === WebSocketImpl.CLOSING || socket.readyState === WebSocketImpl.CLOSED) {
    return
  }

  socket.close(code, reason)
}

export const broadcastTerminalEvent = (runtime: TerminalRuntime, event: TerminalSessionEvent) => {
  const payload = safeJsonStringify(event)
  for (const socket of runtime.sockets) {
    if (socket.readyState === WebSocketImpl.OPEN) {
      socket.send(payload)
    }
  }
}

export const clearIdleTimer = (runtime: TerminalRuntime) => {
  if (runtime.idleTimer == null) {
    return
  }

  clearTimeout(runtime.idleTimer)
  runtime.idleTimer = undefined
}

export const appendScrollback = (runtime: TerminalRuntime, chunk: string) => {
  if (chunk === '') {
    return
  }

  const nextValue = runtime.scrollback + chunk
  runtime.scrollback = nextValue.length > SCROLLBACK_CHAR_LIMIT
    ? nextValue.slice(-SCROLLBACK_CHAR_LIMIT)
    : nextValue
}

const createTerminalRuntime = (
  sessionId: string,
  options: {
    terminalId?: string
    shellKind?: TerminalShellKind
    cols?: number
    rows?: number
    cwd?: string
  } = {}
): TerminalRuntime => {
  const cols = normalizeDimension(options.cols, DEFAULT_COLS, MAX_COLS)
  const rows = normalizeDimension(options.rows, DEFAULT_ROWS, MAX_ROWS)
  const terminalId = normalizeTerminalId(options.terminalId)
  const shellKind = normalizeTerminalShellKind(options.shellKind)

  return {
    sessionId,
    terminalId,
    shellKind,
    runtimeKey: resolveTerminalRuntimeKey(sessionId, terminalId),
    sockets: new Set<WebSocket>(),
    info: {
      sessionId,
      terminalId,
      shellKind,
      cwd: options.cwd ?? getWorkspaceFolder(),
      shell: resolveTerminalShell(shellKind),
      cols,
      rows,
      status: 'running'
    },
    scrollback: '',
    started: false
  }
}

export const buildReadyEvent = (runtime: TerminalRuntime): TerminalSessionEvent => {
  return {
    type: 'terminal_ready',
    info: runtime.info,
    ...(runtime.scrollback !== '' ? { scrollback: runtime.scrollback } : {})
  }
}

export const scheduleTerminalRuntimeDispose = (runtimeKey: string) => {
  const runtime = terminalRuntimeStore.get(runtimeKey)
  if (runtime == null || runtime.idleTimer != null || runtime.sockets.size > 0) {
    return
  }

  runtime.idleTimer = setTimeout(() => {
    const current = terminalRuntimeStore.get(runtimeKey)
    if (current == null || current.sockets.size > 0) {
      return
    }

    current.driver?.kill()
    terminalRuntimeStore.delete(runtimeKey)
  }, IDLE_TIMEOUT_MS)
}

export const scheduleTerminalRuntimeDisposeByRuntime = (runtime: TerminalRuntime) => {
  scheduleTerminalRuntimeDispose(runtime.runtimeKey)
}

export const ensureTerminalRuntime = (
  sessionId: string,
  options: {
    terminalId?: string
    shellKind?: TerminalShellKind
    cols?: number
    rows?: number
    cwd?: string
  } = {}
) => {
  const terminalId = normalizeTerminalId(options.terminalId)
  const runtimeKey = resolveTerminalRuntimeKey(sessionId, terminalId)
  const existing = terminalRuntimeStore.get(runtimeKey)
  if (existing != null) {
    if (options.cols != null) {
      existing.info.cols = normalizeDimension(options.cols, existing.info.cols, MAX_COLS)
    }
    if (options.rows != null) {
      existing.info.rows = normalizeDimension(options.rows, existing.info.rows, MAX_ROWS)
    }
    existing.info.cwd = options.cwd ?? getWorkspaceFolder()
    existing.info.terminalId = terminalId
    if (existing.driver == null) {
      existing.shellKind = normalizeTerminalShellKind(options.shellKind ?? existing.shellKind)
      existing.info.shellKind = existing.shellKind
      existing.info.shell = resolveTerminalShell(existing.shellKind)
    }
    return existing
  }

  const created = createTerminalRuntime(sessionId, options)
  terminalRuntimeStore.set(created.runtimeKey, created)
  return created
}
