import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TerminalSessionCommand, TerminalSessionEvent } from '@vibe-forge/types'

import { createSocket } from '#~/ws.js'

const isSocketOpen = (socket: WebSocket | null): socket is WebSocket => {
  return socket != null && socket.readyState === WebSocket.OPEN
}

export function useTerminalSession({
  sessionId,
  active,
  initialCols,
  initialRows,
  onReady,
  onOutput,
  onExit
}: {
  sessionId: string
  active: boolean
  initialCols: number
  initialRows: number
  onReady: (event: Extract<TerminalSessionEvent, { type: 'terminal_ready' }>) => void
  onOutput: (data: string) => void
  onExit?: (event: Extract<TerminalSessionEvent, { type: 'terminal_exit' }>) => void
}) {
  const { t } = useTranslation()
  const socketRef = useRef<WebSocket | null>(null)
  const expectedCloseRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const restartRequestedRef = useRef(false)
  const onReadyRef = useRef(onReady)
  const onOutputRef = useRef(onOutput)
  const onExitRef = useRef(onExit)
  const [connectVersion, setConnectVersion] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastExit, setLastExit] = useState<{ exitCode: number | null; signal: number | null } | null>(null)

  onReadyRef.current = onReady
  onOutputRef.current = onOutput
  onExitRef.current = onExit

  const sendCommand = useCallback((command: TerminalSessionCommand) => {
    const socket = socketRef.current
    if (!isSocketOpen(socket)) {
      return false
    }

    socket.send(JSON.stringify(command))
    return true
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current)
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      setConnectVersion(current => current + 1)
    }, 800)
  }, [])

  const sendInput = useCallback((data: string) => {
    return sendCommand({
      type: 'terminal_input',
      data
    })
  }, [sendCommand])

  const resizeTerminal = useCallback((cols: number, rows: number) => {
    return sendCommand({
      type: 'terminal_resize',
      cols,
      rows
    })
  }, [sendCommand])

  useEffect(() => {
    if (!active) {
      return
    }

    expectedCloseRef.current = false
    restartRequestedRef.current = false
    setErrorMessage(null)

    const socket = createSocket<TerminalSessionEvent>({
      onOpen: () => undefined,
      onMessage: (event) => {
        switch (event.type) {
          case 'terminal_ready':
            setErrorMessage(null)
            if (event.info.status === 'exited') {
              if (!restartRequestedRef.current) {
                restartRequestedRef.current = true
                socket.send(JSON.stringify(
                  {
                    type: 'terminal_restart',
                    cols: initialCols,
                    rows: initialRows
                  } satisfies TerminalSessionCommand
                ))
              }
              return
            }

            restartRequestedRef.current = false
            setLastExit(null)
            onReadyRef.current(event)
            return
          case 'terminal_output':
            onOutputRef.current(event.data)
            return
          case 'terminal_exit':
            setLastExit({
              exitCode: event.exitCode,
              signal: event.signal
            })
            onExitRef.current?.(event)
            return
          case 'terminal_error':
            setErrorMessage(event.message)
        }
      },
      onError: () => {
        setErrorMessage(t('chat.terminal.connectionError'))
      },
      onClose: () => {
        if (expectedCloseRef.current) {
          return
        }

        scheduleReconnect()
      }
    }, {
      channel: 'terminal',
      sessionId,
      cols: String(initialCols),
      rows: String(initialRows)
    })

    socketRef.current = socket

    return () => {
      expectedCloseRef.current = true
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      socket.close()
      socketRef.current = null
    }
  }, [active, initialCols, initialRows, connectVersion, scheduleReconnect, sessionId, t])

  return {
    errorMessage,
    lastExit,
    resizeTerminal,
    sendInput
  }
}
