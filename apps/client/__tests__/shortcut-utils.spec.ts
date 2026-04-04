import { describe, expect, it } from 'vitest'

import { formatShortcutLabel, getShortcutDisplayTokens } from '#~/utils/shortcutUtils'

describe('formatShortcutLabel', () => {
  it('formats enter and modifiers for mac', () => {
    expect(formatShortcutLabel('mod+enter', true)).toBe('⌘+Enter')
  })

  it('formats shifted shortcuts with title-cased special keys', () => {
    expect(formatShortcutLabel('mod+shift+m', true)).toBe('⌘+Shift+M')
    expect(formatShortcutLabel('mod+escape', false)).toBe('Ctrl+Esc')
  })
})

describe('getShortcutDisplayTokens', () => {
  it('returns compact mac glyphs for modifier shortcuts', () => {
    expect(getShortcutDisplayTokens('mod+shift+m', true)).toEqual([
      { value: '⌘', compact: true },
      { value: '⇧', compact: true },
      { value: 'M', compact: true }
    ])
  })

  it('keeps readable non-mac labels for standard modifiers', () => {
    expect(getShortcutDisplayTokens('mod+enter', false)).toEqual([
      { value: 'Ctrl', compact: false },
      { value: 'Enter', compact: false }
    ])
  })

  it('uses text for enter on mac instead of a symbol glyph', () => {
    expect(getShortcutDisplayTokens('mod+enter', true)).toEqual([
      { value: '⌘', compact: true },
      { value: 'Enter', compact: false }
    ])
  })
})
