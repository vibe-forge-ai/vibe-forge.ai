import { describe, expect, it } from 'vitest'

import { formatShortcutLabel } from '#~/utils/shortcutUtils'

describe('formatShortcutLabel', () => {
  it('formats enter and modifiers for mac', () => {
    expect(formatShortcutLabel('mod+enter', true)).toBe('⌘+Enter')
  })

  it('formats shifted shortcuts with title-cased special keys', () => {
    expect(formatShortcutLabel('mod+shift+m', true)).toBe('⌘+Shift+M')
    expect(formatShortcutLabel('mod+escape', false)).toBe('Ctrl+Esc')
  })
})
