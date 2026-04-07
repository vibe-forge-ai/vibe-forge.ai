import { useCallback, useEffect, useRef, useState } from 'react'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32

const TERMINAL_FOREGROUND = '#e5eef9'
const TERMINAL_CURSOR = '#f8fafc'
const TERMINAL_CURSOR_ACCENT = '#0f172a'
const TERMINAL_SELECTION = 'rgba(96, 165, 250, 0.28)'

const buildTerminalTheme = () => {
  return {
    background: 'transparent',
    foreground: TERMINAL_FOREGROUND,
    cursor: TERMINAL_CURSOR,
    cursorAccent: TERMINAL_CURSOR_ACCENT,
    selectionBackground: TERMINAL_SELECTION,
    black: '#0f172a',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#60a5fa',
    magenta: '#f472b6',
    cyan: '#22d3ee',
    white: '#e2e8f0',
    brightBlack: '#475569',
    brightRed: '#f87171',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#93c5fd',
    brightMagenta: '#f9a8d4',
    brightCyan: '#67e8f9',
    brightWhite: '#f8fafc'
  }
}

export function useTerminalInstance({
  onInput,
  onResize
}: {
  onInput: (data: string) => void
  onResize: (cols: number, rows: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const onInputRef = useRef(onInput)
  const onResizeRef = useRef(onResize)
  const [terminalMounted, setTerminalMounted] = useState(false)
  const [lastMeasuredSize, setLastMeasuredSize] = useState({
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS
  })

  onInputRef.current = onInput
  onResizeRef.current = onResize

  const fitTerminal = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (terminal == null || fitAddon == null) {
      return
    }

    fitAddon.fit()
    if (terminal.cols <= 0 || terminal.rows <= 0) {
      return
    }

    setLastMeasuredSize({
      cols: terminal.cols,
      rows: terminal.rows
    })
    onResizeRef.current(terminal.cols, terminal.rows)
  }, [])

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container == null) {
      return
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      scrollback: 5000,
      theme: buildTerminalTheme()
    })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(container)
    terminal.focus()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    setTerminalMounted(true)
    fitTerminal()

    const dataDisposable = terminal.onData((data) => {
      onInputRef.current(data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitTerminal()
    })
    resizeObserver.observe(container)

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = buildTerminalTheme()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => {
      themeObserver.disconnect()
      resizeObserver.disconnect()
      dataDisposable.dispose()
      fitAddon.dispose()
      terminal.dispose()
      fitAddonRef.current = null
      terminalRef.current = null
    }
  }, [fitTerminal])

  return {
    containerRef,
    fitTerminal,
    focusTerminal,
    lastMeasuredSize,
    terminalMounted,
    terminalRef
  }
}
