import * as monacoApi from 'monaco-editor'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { useEffect, useState } from 'react'

const SENDER_MONACO_LIGHT_THEME = 'vf-sender-light'
const SENDER_MONACO_DARK_THEME = 'vf-sender-dark'
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

const readCssColor = (styles: CSSStyleDeclaration, name: string, fallback: string) => {
  const value = styles.getPropertyValue(name).trim()

  if (HEX_COLOR_PATTERN.test(value)) {
    return value
  }

  return fallback
}

const buildSenderMonacoTheme = (isDark: boolean): MonacoEditorNamespace.IStandaloneThemeData => {
  const styles = window.getComputedStyle(document.documentElement)
  const background = readCssColor(styles, '--bg-color', isDark ? '#141414' : '#ffffff')
  const foreground = readCssColor(styles, '--text-color', isDark ? '#ffffff' : '#000000')
  const placeholder = readCssColor(styles, '--placeholder-color', isDark ? '#575859' : '#9ca3af')
  const primaryColor = readCssColor(styles, '--primary-color', isDark ? '#3b82f6' : '#2563eb')
  const selectionBackground = readCssColor(styles, '--primary-soft-bg', isDark ? '#111b26' : '#eff6ff')

  return {
    base: isDark ? 'vs-dark' : 'vs',
    colors: {
      'editor.background': background,
      'editor.foreground': foreground,
      'editor.inactiveSelectionBackground': selectionBackground,
      'editor.placeholder.foreground': placeholder,
      'editor.selectionBackground': selectionBackground,
      'editorCursor.foreground': primaryColor
    },
    inherit: false,
    rules: []
  }
}

const defineSenderMonacoTheme = (isDark: boolean) => {
  const themeName = isDark ? SENDER_MONACO_DARK_THEME : SENDER_MONACO_LIGHT_THEME

  monacoApi.editor.defineTheme(themeName, buildSenderMonacoTheme(isDark))

  return themeName
}

const getThemeName = () => defineSenderMonacoTheme(document.documentElement.classList.contains('dark'))

export const useSenderMonacoTheme = () => {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const syncThemeName = () => {
      setThemeName(getThemeName())
    }
    const observer = new MutationObserver(syncThemeName)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    syncThemeName()

    return () => {
      observer.disconnect()
    }
  }, [])

  return themeName
}
