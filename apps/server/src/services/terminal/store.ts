import process from 'node:process'

import { WebSocket as WebSocketImpl } from 'ws'
import type { WebSocket } from 'ws'

import type { TerminalSessionEvent, TerminalSessionInfo } from '@vibe-forge/types'

import { getWorkspaceFolder } from '#~/services/config/index.js'
import { safeJsonStringify } from '#~/utils/json.js'

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32
const MAX_COLS = 320
const MAX_ROWS = 120
const SCROLLBACK_CHAR_LIMIT = 200_000
const IDLE_TIMEOUT_MS = 60_000

export interface TerminalRuntime {
  sessionId: string
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

export const resolveTerminalShell = () => {
  if (process.platform === 'win32') {
    return process.env.COMSPEC?.trim() || 'powershell.exe'
  }

  return process.env.SHELL?.trim() || 'bash'
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
    cols?: number
    rows?: number
    cwd?: string
  } = {}
): TerminalRuntime => {
  const cols = normalizeDimension(options.cols, DEFAULT_COLS, MAX_COLS)
  const rows = normalizeDimension(options.rows, DEFAULT_ROWS, MAX_ROWS)

  return {
    sessionId,
    sockets: new Set<WebSocket>(),
    info: {
      sessionId,
      cwd: options.cwd ?? getWorkspaceFolder(),
      shell: resolveTerminalShell(),
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

export const scheduleTerminalRuntimeDispose = (sessionId: string) => {
  const runtime = terminalRuntimeStore.get(sessionId)
  if (runtime == null || runtime.idleTimer != null || runtime.sockets.size > 0) {
    return
  }

  runtime.idleTimer = setTimeout(() => {
    const current = terminalRuntimeStore.get(sessionId)
    if (current == null || current.sockets.size > 0) {
      return
    }

    current.driver?.kill()
    terminalRuntimeStore.delete(sessionId)
  }, IDLE_TIMEOUT_MS)
}

export const ensureTerminalRuntime = (
  sessionId: string,
  options: {
    cols?: number
    rows?: number
    cwd?: string
  } = {}
) => {
  const existing = terminalRuntimeStore.get(sessionId)
  if (existing != null) {
    if (options.cols != null) {
      existing.info.cols = normalizeDimension(options.cols, existing.info.cols, MAX_COLS)
    }
    if (options.rows != null) {
      existing.info.rows = normalizeDimension(options.rows, existing.info.rows, MAX_ROWS)
    }
    existing.info.cwd = options.cwd ?? getWorkspaceFolder()
    if (existing.driver == null) {
      existing.info.shell = resolveTerminalShell()
    }
    return existing
  }

  const created = createTerminalRuntime(sessionId, options)
  terminalRuntimeStore.set(sessionId, created)
  return created
}
