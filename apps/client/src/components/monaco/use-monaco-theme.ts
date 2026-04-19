import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { useEffect, useState } from 'react'

import { monacoApi } from './monaco-runtime'

const LIGHT_THEME = 'vf-workspace-light'
const DARK_THEME = 'vf-workspace-dark'
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

const readCssColor = (styles: CSSStyleDeclaration, name: string, fallback: string) => {
  const value = styles.getPropertyValue(name).trim()
  return HEX_COLOR_PATTERN.test(value) ? value : fallback
}

const buildTheme = (isDark: boolean): MonacoEditorNamespace.IStandaloneThemeData => {
  const styles = window.getComputedStyle(document.documentElement)
  const background = readCssColor(styles, '--bg-color', isDark ? '#141414' : '#ffffff')
  const foreground = readCssColor(styles, '--text-color', isDark ? '#ffffff' : '#111827')
  const primaryColor = readCssColor(styles, '--primary-color', isDark ? '#3b82f6' : '#2563eb')
  const selectionBackground = readCssColor(styles, '--primary-soft-bg', isDark ? '#111b26' : '#eff6ff')

  return {
    base: isDark ? 'vs-dark' : 'vs',
    colors: {
      'editor.background': background,
      'editor.foreground': foreground,
      'editor.inactiveSelectionBackground': selectionBackground,
      'editor.selectionBackground': selectionBackground,
      'editorCursor.foreground': primaryColor
    },
    inherit: true,
    rules: []
  }
}

const defineTheme = (isDark: boolean) => {
  const themeName = isDark ? DARK_THEME : LIGHT_THEME
  monacoApi.editor.defineTheme(themeName, buildTheme(isDark))
  return themeName
}

const getThemeName = () => defineTheme(document.documentElement.classList.contains('dark'))

export const useMonacoTheme = () => {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const syncThemeName = () => setThemeName(getThemeName())
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
