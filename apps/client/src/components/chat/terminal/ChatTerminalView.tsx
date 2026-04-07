import '@xterm/xterm/css/xterm.css'
import './ChatTerminalView.scss'

import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useTerminalInstance } from './@hooks/use-terminal-instance'
import { useTerminalSession } from './@hooks/use-terminal-session'

export function ChatTerminalView({
  sessionId
}: {
  sessionId: string
}) {
  const { t } = useTranslation()
  const inputHandlerRef = React.useRef<(data: string) => void>(() => undefined)
  const resizeHandlerRef = React.useRef<(cols: number, rows: number) => void>(() => undefined)
  const {
    containerRef,
    fitTerminal,
    focusTerminal,
    lastMeasuredSize,
    terminalMounted,
    terminalRef
  } = useTerminalInstance({
    onInput: (data: string) => inputHandlerRef.current(data),
    onResize: (cols: number, rows: number) => resizeHandlerRef.current(cols, rows)
  })

  const {
    errorMessage,
    lastExit,
    resizeTerminal,
    sendInput
  } = useTerminalSession({
    sessionId,
    active: terminalMounted,
    initialCols: lastMeasuredSize.cols,
    initialRows: lastMeasuredSize.rows,
    onReady: useCallback((event) => {
      const terminal = terminalRef.current
      if (terminal == null) {
        return
      }

      terminal.reset()
      if (event.scrollback != null && event.scrollback !== '') {
        terminal.write(event.scrollback)
      }
      fitTerminal()
    }, [fitTerminal, terminalRef]),
    onOutput: useCallback((data) => {
      terminalRef.current?.write(data)
    }, [terminalRef])
  })

  inputHandlerRef.current = (data: string) => {
    void sendInput(data)
  }
  resizeHandlerRef.current = (cols: number, rows: number) => {
    void resizeTerminal(cols, rows)
  }

  const exitSummary = lastExit == null
    ? null
    : t('chat.terminal.exitSummary', {
      code: lastExit.exitCode ?? 'null',
      signal: lastExit.signal ?? 'null'
    })

  return (
    <div className='chat-terminal-view'>
      {errorMessage != null && errorMessage !== '' && (
        <div className='chat-terminal-view__error'>
          {errorMessage}
        </div>
      )}

      <div className='chat-terminal-view__surface'>
        <div
          ref={containerRef}
          className='chat-terminal-view__terminal'
          onClick={focusTerminal}
        />
      </div>

      {exitSummary != null && (
        <div className='chat-terminal-view__footer'>
          {exitSummary}
        </div>
      )}
    </div>
  )
}
