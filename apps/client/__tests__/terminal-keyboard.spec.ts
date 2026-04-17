import { describe, expect, it } from 'vitest'

import { getTerminalKeyboardAction } from '../src/components/chat/terminal/@utils/terminal-keyboard'

const createKeyEvent = (event: Partial<KeyboardEvent>): KeyboardEvent => ({
  altKey: false,
  ctrlKey: false,
  key: '',
  metaKey: false,
  shiftKey: false,
  ...event
} as KeyboardEvent)

describe('terminal keyboard shortcuts', () => {
  it('uses plain cursor movement for normal buffer word navigation', () => {
    expect(getTerminalKeyboardAction(createKeyEvent({ altKey: true, key: 'ArrowLeft' }), {
      cursorX: 15,
      lineText: '% print foo bar'
    })).toEqual({
      type: 'input',
      data: '\x1B[D\x1B[D\x1B[D'
    })
    expect(getTerminalKeyboardAction(createKeyEvent({ altKey: true, key: 'ArrowRight' }), {
      cursorX: 12,
      lineText: '% print foo bar'
    })).toEqual({
      type: 'input',
      data: '\x1B[C\x1B[C\x1B[C'
    })
  })

  it('does not emit readline meta-f for option right in the normal buffer', () => {
    expect(getTerminalKeyboardAction(createKeyEvent({ altKey: true, key: 'ArrowRight' }), {
      cursorX: 12,
      lineText: '% print foo bar'
    })).not.toEqual({
      type: 'input',
      data: '\x1Bf'
    })
  })

  it('keeps modified arrow identity in the alternate terminal buffer', () => {
    expect(getTerminalKeyboardAction(createKeyEvent({ altKey: true, key: 'ArrowLeft' }), {
      isAlternateBuffer: true
    })).toEqual({
      type: 'input',
      data: '\x1B[1;3D'
    })
    expect(getTerminalKeyboardAction(createKeyEvent({ altKey: true, key: 'ArrowRight' }), {
      isAlternateBuffer: true
    })).toEqual({
      type: 'input',
      data: '\x1B[1;3C'
    })
  })

  it('keeps ctrl word navigation for non-apple platforms', () => {
    expect(getTerminalKeyboardAction(createKeyEvent({ ctrlKey: true, key: 'ArrowRight' }), {
      platform: 'Linux x86_64'
    })).toEqual({
      type: 'input',
      data: '\x1B[1;5C'
    })
  })

  it('uses platform-specific clear output shortcuts', () => {
    expect(getTerminalKeyboardAction(createKeyEvent({ key: 'k', metaKey: true }), {
      platform: 'MacIntel'
    })).toEqual({ type: 'clear' })
    expect(getTerminalKeyboardAction(createKeyEvent({ key: 'k', ctrlKey: true }), {
      platform: 'Linux x86_64'
    })).toEqual({ type: 'clear' })
  })
})
