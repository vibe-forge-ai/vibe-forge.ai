import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export type ShortcutSpec = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const normalizeKey = (key: string) => {
  if (key === ' ') return 'space'
  return key.toLowerCase()
}

export const parseShortcut = (shortcut: string | undefined, isMac: boolean) => {
  if (shortcut == null || shortcut.trim() === '') return null
  const tokens = shortcut.split('+').map(token => token.trim()).filter(Boolean)
  if (tokens.length === 0) return null
  const parsed: ShortcutSpec = {
    key: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false
  }
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'cmd' || lower === 'command' || lower === 'meta') {
      parsed.metaKey = true
    } else if (lower === 'ctrl' || lower === 'control') {
      parsed.ctrlKey = true
    } else if (lower === 'alt' || lower === 'option') {
      parsed.altKey = true
    } else if (lower === 'shift') {
      parsed.shiftKey = true
    } else if (lower === 'mod') {
      if (isMac) parsed.metaKey = true
      else parsed.ctrlKey = true
    } else {
      parsed.key = normalizeKey(lower)
    }
  }
  return parsed.key === '' ? null : parsed
}

export const formatShortcutLabel = (shortcut: string | undefined, isMac: boolean) => {
  if (shortcut == null || shortcut.trim() === '') return ''
  const tokens = shortcut.split('+').map(token => token.trim()).filter(Boolean)
  return tokens.map((token) => {
    const lower = token.toLowerCase()
    if (lower === 'mod') return isMac ? '⌘' : 'Ctrl'
    if (lower === 'cmd' || lower === 'command' || lower === 'meta') return '⌘'
    if (lower === 'ctrl' || lower === 'control') return 'Ctrl'
    if (lower === 'alt' || lower === 'option') return 'Alt'
    if (lower === 'shift') return 'Shift'
    if (lower === 'space') return 'Space'
    if (token.length === 1) return token.toUpperCase()
    return token
  }).join('+')
}

export const isShortcutMatch = (
  e: KeyboardEvent | ReactKeyboardEvent,
  shortcut: string | undefined,
  isMac: boolean
) => {
  const parsed = parseShortcut(shortcut, isMac)
  if (parsed == null) return false
  if (e.metaKey !== parsed.metaKey) return false
  if (e.ctrlKey !== parsed.ctrlKey) return false
  if (e.altKey !== parsed.altKey) return false
  if (e.shiftKey !== parsed.shiftKey) return false
  return normalizeKey(e.key) === parsed.key
}

export const getShortcutFromEvent = (
  e: KeyboardEvent | ReactKeyboardEvent
) => {
  const key = normalizeKey(e.key)
  if (['meta', 'control', 'shift', 'alt'].includes(key)) return null
  const tokens: string[] = []
  if (e.metaKey || e.ctrlKey) tokens.push('mod')
  if (e.shiftKey) tokens.push('shift')
  if (e.altKey) tokens.push('alt')
  tokens.push(key)
  return tokens.join('+')
}
