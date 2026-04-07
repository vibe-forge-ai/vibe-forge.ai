import '@xterm/xterm/css/xterm.css'
import './ChatTerminalView.scss'

import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DockPanel } from '#~/components/dock-panel/DockPanel'
import { useTerminalInstance } from './@hooks/use-terminal-instance'
import { useTerminalSession } from './@hooks/use-terminal-session'

const TERMINAL_HEIGHT_STORAGE_KEY = 'chatTerminalHeight'
const formatShellLabel = (shell: string | undefined) => shell?.split('/').filter(Boolean).at(-1) ?? 'shell'

export function ChatTerminalView({
  isOpen,
  onClose,
  sessionId
}: {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}) {
  const { t } = useTranslation()
  const inputHandlerRef = React.useRef<(data: string) => void>(() => undefined)
  const resizeHandlerRef = React.useRef<(cols: number, rows: number) => void>(() => undefined)
  const [shellLabel, setShellLabel] = useState('zsh')
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
      setShellLabel(formatShellLabel(event.info.shell))
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
    <DockPanel
      className='chat-terminal-view'
      isOpen={isOpen}
      title={t('chat.viewTerminal')}
      meta={shellLabel}
      closeLabel={t('common.close')}
      resizeLabel={t('chat.terminal.resizePanel')}
      storageKey={TERMINAL_HEIGHT_STORAGE_KEY}
      onClose={onClose}
      footer={exitSummary != null
        ? (
          <div className='chat-terminal-view__footer'>
            {exitSummary}
          </div>
        )
        : undefined}
    >
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
    </DockPanel>
  )
}
