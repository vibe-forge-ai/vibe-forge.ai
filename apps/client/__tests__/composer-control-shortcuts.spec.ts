import { describe, expect, it } from 'vitest'

import {
  composerControlShortcutDefaults,
  resolveComposerControlShortcuts
} from '#~/hooks/chat/use-composer-control-shortcuts'
import { getLoopedIndex } from '#~/hooks/use-roving-focus-list'

describe('composer control shortcuts', () => {
  it('falls back to the default shortcuts when config values are missing', () => {
    expect(resolveComposerControlShortcuts()).toEqual(composerControlShortcutDefaults)
  })

  it('keeps configured shortcut overrides', () => {
    expect(resolveComposerControlShortcuts({
      switchModel: 'mod+alt+m',
      switchEffort: 'mod+y',
      switchPermissionMode: 'mod+shift+p'
    })).toEqual({
      switchModel: 'mod+alt+m',
      switchEffort: 'mod+y',
      switchPermissionMode: 'mod+shift+p'
    })
  })
})

describe('roving focus list helpers', () => {
  it('wraps forward navigation to the first item', () => {
    expect(getLoopedIndex(2, 1, 3)).toBe(0)
  })

  it('wraps backward navigation to the last item', () => {
    expect(getLoopedIndex(0, -1, 3)).toBe(2)
  })
})
