import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TerminalSessionCommand, TerminalSessionEvent, TerminalShellKind } from '@vibe-forge/types'

import { createSocket } from '#~/ws.js'

const isSocketOpen = (socket: WebSocket | null): socket is WebSocket =>
  socket != null && socket.readyState === WebSocket.OPEN

export function useTerminalSession({
  sessionId,
  shellKind,
  terminalId,
  active,
  initialCols,
  initialRows,
  onReady,
  onOutput,
  onExit
}: {
  sessionId: string
  shellKind?: TerminalShellKind
  terminalId?: string
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
  const fatalErrorRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const restartRequestedRef = useRef(false)
  const latestSizeRef = useRef({ cols: initialCols, rows: initialRows })
  const pendingResizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const onReadyRef = useRef(onReady)
  const onOutputRef = useRef(onOutput)
  const onExitRef = useRef(onExit)
  const [connectVersion, setConnectVersion] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastExit, setLastExit] = useState<{ exitCode: number | null; signal: number | null } | null>(null)

  onReadyRef.current = onReady
  onOutputRef.current = onOutput
  onExitRef.current = onExit
  latestSizeRef.current = { cols: initialCols, rows: initialRows }

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

  const sendInput = useCallback((data: string) => sendCommand({ type: 'terminal_input', data }), [sendCommand])
  const sendResizeCommand = useCallback(
    (cols: number, rows: number) => sendCommand({ type: 'terminal_resize', cols, rows }),
    [sendCommand]
  )
  const terminateTerminal = useCallback(() => sendCommand({ type: 'terminal_terminate' }), [sendCommand])
  const flushPendingResize = useCallback(() => {
    const pendingResize = pendingResizeRef.current
    if (pendingResize == null) {
      return false
    }

    const sent = sendResizeCommand(pendingResize.cols, pendingResize.rows)
    if (sent) {
      pendingResizeRef.current = null
    }
    return sent
  }, [sendResizeCommand])

  const resizeTerminal = useCallback((cols: number, rows: number) => {
    latestSizeRef.current = { cols, rows }
    pendingResizeRef.current = { cols, rows }
    return flushPendingResize()
  }, [flushPendingResize])

  useEffect(() => {
    if (!active) {
      return
    }

    expectedCloseRef.current = false
    fatalErrorRef.current = false
    restartRequestedRef.current = false
    setErrorMessage(null)
    pendingResizeRef.current = latestSizeRef.current

    const connectSize = latestSizeRef.current

    const socket = createSocket<TerminalSessionEvent>({
      onOpen: () => {
        flushPendingResize()
      },
      onMessage: (event) => {
        switch (event.type) {
          case 'terminal_ready':
            setErrorMessage(null)
            if (event.info.status === 'exited') {
              if (!restartRequestedRef.current) {
                restartRequestedRef.current = true
                const restartSize = latestSizeRef.current
                socket.send(JSON.stringify(
                  {
                    type: 'terminal_restart',
                    cols: restartSize.cols,
                    rows: restartSize.rows
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
            fatalErrorRef.current = event.fatal === true
            setErrorMessage(event.message)
        }
      },
      onError: () => {
        setErrorMessage(t('chat.terminal.connectionError'))
      },
      onClose: () => {
        socketRef.current = null
        if (expectedCloseRef.current || fatalErrorRef.current) {
          return
        }

        scheduleReconnect()
      }
    }, {
      channel: 'terminal',
      sessionId,
      shellKind: shellKind ?? 'default',
      terminalId: terminalId ?? '',
      cols: String(connectSize.cols),
      rows: String(connectSize.rows)
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
  }, [active, connectVersion, flushPendingResize, scheduleReconnect, sessionId, shellKind, t, terminalId])

  return {
    errorMessage,
    lastExit,
    resizeTerminal,
    sendInput,
    terminateTerminal
  }
}
