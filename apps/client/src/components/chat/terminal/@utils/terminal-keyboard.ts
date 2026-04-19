const APPLE_PLATFORM_PATTERN = /mac|iphone|ipad|ipod/i
const WORD_CHARACTER_PATTERN = /\w/
const WORD_NAVIGATION_SEQUENCES = {
  cursorLeft: '\x1B[D',
  cursorRight: '\x1B[C',
  modifiedAltLeft: '\x1B[1;3D',
  modifiedAltRight: '\x1B[1;3C',
  ctrlLeft: '\x1B[1;5D',
  ctrlRight: '\x1B[1;5C'
}

export type TerminalKeyboardAction =
  | { type: 'clear' }
  | { data: string; type: 'input' }

export interface TerminalKeyboardActionOptions {
  cursorX?: number
  isAlternateBuffer?: boolean
  lineText?: string
  platform?: string
}

const getCurrentPlatform = () => globalThis.navigator?.platform ?? ''

const isApplePlatform = (platform = getCurrentPlatform()) => APPLE_PLATFORM_PATTERN.test(platform)

const isClearOutputShortcut = (event: KeyboardEvent, platform?: string) => {
  if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) {
    return false
  }

  return isApplePlatform(platform) ? event.metaKey : event.ctrlKey
}

const isWordCharacter = (character: string) => WORD_CHARACTER_PATTERN.test(character)

const getPreviousWordBoundary = (lineText: string, cursorX: number) => {
  let index = Math.min(Math.max(cursorX, 0), lineText.length)

  while (index > 0 && !isWordCharacter(lineText[index - 1] ?? '')) {
    index -= 1
  }

  while (index > 0 && isWordCharacter(lineText[index - 1] ?? '')) {
    index -= 1
  }

  return index
}

const getNextWordBoundary = (lineText: string, cursorX: number) => {
  let index = Math.min(Math.max(cursorX, 0), lineText.length)

  if (isWordCharacter(lineText[index] ?? '')) {
    while (index < lineText.length && isWordCharacter(lineText[index] ?? '')) {
      index += 1
    }
    return index
  }

  while (index < lineText.length && !isWordCharacter(lineText[index] ?? '')) {
    index += 1
  }

  while (index < lineText.length && isWordCharacter(lineText[index] ?? '')) {
    index += 1
  }

  return index
}

const repeatSequence = (sequence: string, count: number) => count <= 0 ? '' : sequence.repeat(count)

const getRenderedWordNavigationSequence = (
  event: KeyboardEvent,
  options: TerminalKeyboardActionOptions
) => {
  const cursorX = options.cursorX
  const lineText = options.lineText
  if (cursorX == null || lineText == null) {
    return null
  }

  if (event.key === 'ArrowLeft') {
    return repeatSequence(
      WORD_NAVIGATION_SEQUENCES.cursorLeft,
      cursorX - getPreviousWordBoundary(lineText, cursorX)
    )
  }

  return repeatSequence(
    WORD_NAVIGATION_SEQUENCES.cursorRight,
    getNextWordBoundary(lineText, cursorX) - cursorX
  )
}

const getWordNavigationSequence = (
  event: KeyboardEvent,
  options: TerminalKeyboardActionOptions
) => {
  if (event.metaKey || event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
    return null
  }

  if (event.altKey && !event.ctrlKey) {
    if (options.isAlternateBuffer === true) {
      return event.key === 'ArrowLeft'
        ? WORD_NAVIGATION_SEQUENCES.modifiedAltLeft
        : WORD_NAVIGATION_SEQUENCES.modifiedAltRight
    }

    return getRenderedWordNavigationSequence(event, options)
  }

  if (!isApplePlatform(options.platform) && event.ctrlKey && !event.altKey) {
    return event.key === 'ArrowLeft'
      ? WORD_NAVIGATION_SEQUENCES.ctrlLeft
      : WORD_NAVIGATION_SEQUENCES.ctrlRight
  }

  return null
}

export const getTerminalKeyboardAction = (
  event: KeyboardEvent,
  options: TerminalKeyboardActionOptions = {}
): TerminalKeyboardAction | null => {
  if (isClearOutputShortcut(event, options.platform)) {
    return { type: 'clear' }
  }

  const wordNavigationSequence = getWordNavigationSequence(event, options)
  if (wordNavigationSequence == null) {
    return null
  }

  return {
    type: 'input',
    data: wordNavigationSequence
  }
}
