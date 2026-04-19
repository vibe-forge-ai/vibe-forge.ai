const KEYBOARD_VISIBLE_THRESHOLD = 80

const focusableSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="textbox"]'
].join(',')

const getViewport = () => globalThis.visualViewport

const getFocusedInput = () => {
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return undefined
  return activeElement.matches(focusableSelector) ? activeElement : undefined
}

const scrollFocusedInputIntoView = () => {
  const focusedInput = getFocusedInput()
  if (focusedInput == null) return

  focusedInput.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: 'auto'
  })
}

export const setupMobileViewport = () => {
  if (typeof window === 'undefined') return

  let scrollFrame = 0

  const updateViewportVars = () => {
    const viewport = getViewport()
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportOffsetTop = viewport?.offsetTop ?? 0
    const focusedInput = getFocusedInput()
    const keyboardInset = viewport == null || focusedInput == null
      ? 0
      : Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop)

    document.documentElement.style.setProperty('--vf-visual-viewport-height', `${Math.round(viewportHeight)}px`)
    document.documentElement.style.setProperty('--vf-keyboard-inset-bottom', `${Math.round(keyboardInset)}px`)
    document.documentElement.classList.toggle('has-mobile-keyboard', keyboardInset > KEYBOARD_VISIBLE_THRESHOLD)
  }

  const scheduleFocusedInputScroll = () => {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = window.requestAnimationFrame(() => {
      updateViewportVars()
      scrollFocusedInputIntoView()
    })
  }

  updateViewportVars()

  getViewport()?.addEventListener('resize', scheduleFocusedInputScroll)
  getViewport()?.addEventListener('scroll', scheduleFocusedInputScroll)
  window.addEventListener('resize', scheduleFocusedInputScroll)
  window.addEventListener('orientationchange', scheduleFocusedInputScroll)
  document.addEventListener('focusin', scheduleFocusedInputScroll)
  document.addEventListener('focusout', () => {
    window.setTimeout(updateViewportVars, 120)
  })
}
