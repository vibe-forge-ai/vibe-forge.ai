import './TerminalPane.scss'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TerminalShellKind } from '@vibe-forge/types'

import { useTerminalInstance } from '../@hooks/use-terminal-instance'
import { useTerminalSession } from '../@hooks/use-terminal-session'

const formatShellLabel = (shell: string | undefined) => shell?.split('/').filter(Boolean).at(-1) ?? 'shell'

export function TerminalPane({
  isActive,
  onInfoChange,
  onTerminateChange,
  sessionId,
  shellKind,
  terminalId
}: {
  isActive: boolean
  onInfoChange: (terminalId: string, info: { shellLabel: string; isExited: boolean }) => void
  onTerminateChange: (terminalId: string, handler: (() => boolean) | null) => void
  sessionId: string
  shellKind: TerminalShellKind
  terminalId: string
}) {
  const { t } = useTranslation()
  const inputHandlerRef = useRef<(data: string) => void>(() => undefined)
  const resizeHandlerRef = useRef<(cols: number, rows: number) => void>(() => undefined)
  const [shellLabel, setShellLabel] = useState('shell')
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
    sendInput,
    terminateTerminal
  } = useTerminalSession({
    sessionId,
    shellKind,
    terminalId,
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

  useEffect(() => {
    onTerminateChange(terminalId, terminateTerminal)
    return () => {
      onTerminateChange(terminalId, null)
    }
  }, [onTerminateChange, terminalId, terminateTerminal])

  useEffect(() => {
    onInfoChange(terminalId, {
      shellLabel,
      isExited: lastExit != null
    })
  }, [lastExit, onInfoChange, shellLabel, terminalId])

  useEffect(() => {
    if (!isActive) {
      return
    }

    window.requestAnimationFrame(() => {
      fitTerminal()
      focusTerminal()
    })
  }, [fitTerminal, focusTerminal, isActive])

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
    <section className={`chat-terminal-pane ${isActive ? 'is-active' : ''}`} aria-hidden={!isActive}>
      <div className='chat-terminal-pane__body'>
        {errorMessage != null && errorMessage !== '' && (
          <div className='chat-terminal-pane__error'>
            {errorMessage}
          </div>
        )}

        <div
          ref={containerRef}
          className='chat-terminal-pane__terminal'
          onClick={focusTerminal}
        />
      </div>

      {exitSummary != null && (
        <div className='chat-terminal-pane__footer'>
          {exitSummary}
        </div>
      )}
    </section>
  )
}
