import type { Buffer } from 'node:buffer'

import { WebSocket as WebSocketImpl } from 'ws'
import type { WebSocket } from 'ws'

import type { TerminalSessionCommand } from '@vibe-forge/types'

import { attachTerminalSocket, detachTerminalSocket, handleTerminalCommand } from '#~/services/terminal/index.js'
import { getSessionLogger } from '#~/utils/logger.js'

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32

const parseDimension = (value: string | null, fallback: number) => {
  if (value == null || value.trim() === '') {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const isTerminalSessionCommand = (value: unknown): value is TerminalSessionCommand => {
  if (value == null || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<TerminalSessionCommand>
  return candidate.type === 'terminal_input' ||
    candidate.type === 'terminal_resize' ||
    candidate.type === 'terminal_restart' ||
    candidate.type === 'terminal_terminate'
}

export function sendTerminalFatalError(
  ws: WebSocket,
  message: string,
  closeCode = 1011
) {
  if (ws.readyState !== WebSocketImpl.OPEN) {
    if (ws.readyState === WebSocketImpl.CONNECTING) {
      ws.close(closeCode, message)
    }
    return
  }

  ws.send(
    JSON.stringify({
      type: 'terminal_error',
      message,
      fatal: true
    }),
    (error) => {
      if (error != null) {
        ws.terminate()
        return
      }

      if (ws.readyState === WebSocketImpl.OPEN) {
        ws.close(closeCode, message)
      }
    }
  )
}

export function handleTerminalSocketConnection(
  ws: WebSocket,
  sessionId: string,
  params: URLSearchParams
) {
  const logger = getSessionLogger(sessionId, 'server')
  const cols = parseDimension(params.get('cols'), DEFAULT_COLS)
  const rows = parseDimension(params.get('rows'), DEFAULT_ROWS)

  try {
    attachTerminalSocket(sessionId, ws, { cols, rows })
  } catch (error) {
    logger.error(
      { err: error, sessionId, cols, rows },
      '[terminal] Failed to establish terminal websocket session'
    )
    sendTerminalFatalError(ws, error instanceof Error ? error.message : String(error))
    return
  }

  ws.on('message', (raw: Buffer) => {
    try {
      const payload = JSON.parse(String(raw)) as unknown
      if (!isTerminalSessionCommand(payload)) {
        throw new Error('Invalid terminal command')
      }

      handleTerminalCommand(sessionId, payload)
    } catch (error) {
      logger.warn(
        { sessionId, error: error instanceof Error ? error.message : String(error) },
        '[terminal] Failed to handle terminal websocket message'
      )
    }
  })

  ws.on('close', () => {
    detachTerminalSocket(sessionId, ws)
  })
}
