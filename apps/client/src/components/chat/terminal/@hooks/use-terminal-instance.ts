import { useCallback, useEffect, useRef, useState } from 'react'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32

const readCssVar = (styles: CSSStyleDeclaration, name: string, fallback: string) => {
  const value = styles.getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

const buildTerminalTheme = () => {
  const styles = window.getComputedStyle(document.documentElement)
  const isDark = document.documentElement.classList.contains('dark')
  const background = readCssVar(styles, '--bg-color', isDark ? '#141414' : '#ffffff')
  const foreground = readCssVar(styles, '--text-color', isDark ? '#ffffff' : '#000000')
  const subForeground = readCssVar(styles, '--sub-text-color', isDark ? '#8c8c8c' : '#1b1b1b')
  const primaryColor = readCssVar(styles, '--primary-color', isDark ? '#3b82f6' : '#2563eb')
  const primarySoftBg = readCssVar(styles, '--primary-soft-bg', isDark ? '#111b26' : '#eff6ff')

  return {
    background,
    foreground,
    cursor: primaryColor,
    cursorAccent: background,
    selectionBackground: primarySoftBg,
    black: isDark ? '#0f172a' : '#111827',
    red: isDark ? '#ef4444' : '#dc2626',
    green: isDark ? '#10b981' : '#047857',
    yellow: isDark ? '#f59e0b' : '#b45309',
    blue: isDark ? '#60a5fa' : '#2563eb',
    magenta: isDark ? '#f472b6' : '#c026d3',
    cyan: isDark ? '#22d3ee' : '#0f766e',
    white: isDark ? '#e2e8f0' : subForeground,
    brightBlack: isDark ? '#475569' : '#4b5563',
    brightRed: isDark ? '#f87171' : '#ef4444',
    brightGreen: isDark ? '#34d399' : '#10b981',
    brightYellow: isDark ? '#fbbf24' : '#f59e0b',
    brightBlue: isDark ? '#93c5fd' : '#3b82f6',
    brightMagenta: isDark ? '#f9a8d4' : '#d946ef',
    brightCyan: isDark ? '#67e8f9' : '#14b8a6',
    brightWhite: foreground
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
      attributeFilter: ['class', 'style']
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
