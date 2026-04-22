import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const getFocusableElements = (container: HTMLElement) => {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true' &&
      element.offsetParent !== null
    )
}

const focusElement = (element: HTMLElement) => {
  try {
    element.focus({ preventScroll: true })
  } catch {
    element.focus()
  }
}

const focusFirstElement = (container: HTMLElement) => {
  const focusableElements = getFocusableElements(container)
  const firstFocusableElement = focusableElements[0]
  if (firstFocusableElement != null) {
    focusElement(firstFocusableElement)
  } else {
    focusElement(container)
  }
  return focusableElements
}

export function useMobileSidebarModal({
  backgroundRefs,
  isCompactLayout,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  sheetRef
}: {
  backgroundRefs: Array<RefObject<HTMLElement | null>>
  isCompactLayout: boolean
  isMobileSidebarOpen: boolean
  setIsMobileSidebarOpen: (nextOpen: boolean) => void
  sheetRef: RefObject<HTMLDivElement | null>
}) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isCompactLayout) {
      backgroundRefs.forEach((ref) => {
        ref.current?.removeAttribute('inert')
      })
      return
    }

    backgroundRefs.forEach((ref) => {
      const element = ref.current
      if (element == null) {
        return
      }

      if (isMobileSidebarOpen) {
        element.setAttribute('inert', '')
      } else {
        element.removeAttribute('inert')
      }
    })

    return () => {
      backgroundRefs.forEach((ref) => {
        ref.current?.removeAttribute('inert')
      })
    }
  }, [backgroundRefs, isCompactLayout, isMobileSidebarOpen])

  useEffect(() => {
    if (!isCompactLayout || !isMobileSidebarOpen) {
      return
    }

    const activeElement = document.activeElement
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null

    const focusFrame = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current
      if (sheet == null) {
        return
      }

      focusFirstElement(sheet)
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const sheet = sheetRef.current
      if (sheet == null) {
        return
      }

      const focusableElements = getFocusableElements(sheet)
      if (focusableElements.length === 0) {
        event.preventDefault()
        focusElement(sheet)
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeTarget = document.activeElement

      if (event.shiftKey) {
        if (activeTarget === firstElement || activeTarget === sheet) {
          event.preventDefault()
          focusElement(lastElement)
        }
        return
      }

      if (activeTarget === lastElement) {
        event.preventDefault()
        focusElement(firstElement)
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      const sheet = sheetRef.current
      const focusTarget = event.target
      if (sheet == null || !(focusTarget instanceof HTMLElement)) {
        return
      }

      if (sheet.contains(focusTarget)) {
        return
      }

      focusFirstElement(sheet)
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)

      const restoreFocusTarget = restoreFocusRef.current
      if (restoreFocusTarget != null && document.contains(restoreFocusTarget)) {
        window.requestAnimationFrame(() => {
          if (document.contains(restoreFocusTarget)) {
            focusElement(restoreFocusTarget)
          }
        })
      }
      restoreFocusRef.current = null
    }
  }, [isCompactLayout, isMobileSidebarOpen, setIsMobileSidebarOpen, sheetRef])

  useEffect(() => {
    if (!isCompactLayout || !isMobileSidebarOpen) {
      return
    }

    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousDocumentOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousBodyOverflow
      documentElement.style.overflow = previousDocumentOverflow
    }
  }, [isCompactLayout, isMobileSidebarOpen])
}
