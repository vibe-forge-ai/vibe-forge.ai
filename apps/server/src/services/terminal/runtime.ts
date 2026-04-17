import process from 'node:process'

import type { TerminalShellKind } from '@vibe-forge/types'

import { getSessionLogger } from '#~/utils/logger.js'

import { createPipeDriver, createPtyDriver } from './driver'
import { normalizeTerminalShellKind, resolveTerminalShell } from './shells'
import type { TerminalRuntime } from './store'
import {
  appendScrollback,
  broadcastTerminalEvent,
  buildReadyEvent,
  clearIdleTimer,
  ensureTerminalRuntime,
  normalizeDimension,
  scheduleTerminalRuntimeDisposeByRuntime
} from './store'

const MAX_COLS = 320
const MAX_ROWS = 120

const applyRuntimeExit = (
  runtime: TerminalRuntime,
  exitCode: number | null,
  signal: number | null
) => {
  runtime.driver = undefined
  runtime.info.pid = undefined
  runtime.info.status = 'exited'

  broadcastTerminalEvent(runtime, {
    type: 'terminal_exit',
    exitCode,
    signal
  })

  if (runtime.sockets.size === 0) {
    scheduleTerminalRuntimeDisposeByRuntime(runtime)
  }
}

const appendTerminalOutput = (runtime: TerminalRuntime, data: string) => {
  appendScrollback(runtime, data)
  broadcastTerminalEvent(runtime, {
    type: 'terminal_output',
    data
  })
}

export function startTerminalSession(
  sessionId: string,
  options: {
    terminalId?: string
    shellKind?: TerminalShellKind
    cols?: number
    rows?: number
    cwd?: string
  } = {}
) {
  const runtime = ensureTerminalRuntime(sessionId, options)
  if (runtime.driver != null) {
    return runtime
  }

  const logger = getSessionLogger(sessionId, 'server')
  const shellKind = normalizeTerminalShellKind(options.shellKind ?? runtime.shellKind)
  const shell = resolveTerminalShell(shellKind)
  const cwd = runtime.info.cwd

  runtime.shellKind = shellKind
  runtime.info.shellKind = shellKind
  runtime.info.shell = shell
  runtime.info.cols = normalizeDimension(options.cols, runtime.info.cols, MAX_COLS)
  runtime.info.rows = normalizeDimension(options.rows, runtime.info.rows, MAX_ROWS)
  runtime.info.status = 'running'
  runtime.scrollback = ''
  runtime.started = true
  clearIdleTimer(runtime)

  logger.info(
    { sessionId, terminalId: runtime.terminalId, shell, cwd, cols: runtime.info.cols, rows: runtime.info.rows },
    '[terminal] Starting shell session'
  )

  const onData = (data: string) => {
    appendTerminalOutput(runtime, data)
  }
  const onExit = ({ exitCode, signal }: { exitCode: number | null; signal: number | null }) => {
    logger.info({ sessionId, terminalId: runtime.terminalId, exitCode, signal }, '[terminal] Shell session exited')
    applyRuntimeExit(runtime, exitCode, signal)
  }

  try {
    runtime.driver = createPtyDriver({
      shell,
      cwd,
      cols: runtime.info.cols,
      rows: runtime.info.rows,
      onData,
      onExit
    })
  } catch (error) {
    const fallbackShell = process.platform === 'win32' ? shell : '/bin/bash'

    logger.warn(
      { err: error, sessionId, shell, fallbackShell, cwd },
      '[terminal] PTY spawn failed, falling back to stdio shell'
    )

    try {
      runtime.info.shell = fallbackShell
      runtime.driver = createPipeDriver({
        shell: fallbackShell,
        cwd,
        onData,
        onExit,
        onError: (childError) => {
          runtime.started = false
          runtime.driver = undefined
          runtime.info.pid = undefined
          runtime.info.status = 'exited'

          logger.error(
            { err: childError, sessionId, shell: fallbackShell, cwd },
            '[terminal] Failed to start fallback shell session'
          )

          broadcastTerminalEvent(runtime, {
            type: 'terminal_error',
            message: childError instanceof Error ? childError.message : String(childError),
            fatal: true
          })
        }
      })
    } catch (fallbackError) {
      runtime.started = false
      runtime.driver = undefined
      runtime.info.pid = undefined
      runtime.info.status = 'exited'

      logger.error(
        { err: fallbackError, sessionId, shell: fallbackShell, cwd },
        '[terminal] Failed to start shell session'
      )
      throw fallbackError
    }
  }

  runtime.info.pid = runtime.driver?.pid
  return runtime
}

export function resizeTerminalSession(
  sessionId: string,
  options: {
    terminalId?: string
    shellKind?: TerminalShellKind
    cols?: number
    rows?: number
    cwd?: string
  }
) {
  const runtime = ensureTerminalRuntime(sessionId, options)
  runtime.info.cols = normalizeDimension(options.cols, runtime.info.cols, MAX_COLS)
  runtime.info.rows = normalizeDimension(options.rows, runtime.info.rows, MAX_ROWS)
  runtime.driver?.resize(runtime.info.cols, runtime.info.rows)
  return runtime
}

export function restartTerminalSession(
  sessionId: string,
  options: {
    terminalId?: string
    shellKind?: TerminalShellKind
    cols?: number
    rows?: number
    cwd?: string
  } = {}
) {
  const runtime = ensureTerminalRuntime(sessionId, options)
  if (runtime.driver != null) {
    broadcastTerminalEvent(runtime, {
      type: 'terminal_error',
      message: 'Terminal session is already running.'
    })
    return runtime
  }

  runtime.started = false
  runtime.scrollback = ''
  const restarted = startTerminalSession(sessionId, options)
  broadcastTerminalEvent(restarted, buildReadyEvent(restarted))
  return restarted
}
