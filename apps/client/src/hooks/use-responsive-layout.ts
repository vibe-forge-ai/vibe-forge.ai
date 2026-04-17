import { useSyncExternalStore } from 'react'

const COMPACT_LAYOUT_QUERY = '(max-width: 960px)'
const TOUCH_INTERACTION_QUERY = '(hover: none), (pointer: coarse)'

export interface ResponsiveLayoutState {
  isCompactLayout: boolean
  isTouchInteraction: boolean
}

const DEFAULT_RESPONSIVE_LAYOUT: ResponsiveLayoutState = {
  isCompactLayout: false,
  isTouchInteraction: false
}

const listeners = new Set<() => void>()

let compactMediaQuery: MediaQueryList | null = null
let touchMediaQuery: MediaQueryList | null = null
let currentSnapshot = DEFAULT_RESPONSIVE_LAYOUT
let mediaListenersInstalled = false
let removeMediaQueryListeners: (() => void) | null = null

const getMediaQueryMatch = (query: string) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia(query).matches
}

const readResponsiveLayoutSnapshot = (): ResponsiveLayoutState => ({
  isCompactLayout: compactMediaQuery?.matches ?? getMediaQueryMatch(COMPACT_LAYOUT_QUERY),
  isTouchInteraction: touchMediaQuery?.matches ?? getMediaQueryMatch(TOUCH_INTERACTION_QUERY)
})

const isSameResponsiveLayoutSnapshot = (
  left: ResponsiveLayoutState,
  right: ResponsiveLayoutState
) => left.isCompactLayout === right.isCompactLayout && left.isTouchInteraction === right.isTouchInteraction

const refreshResponsiveLayoutSnapshot = () => {
  const nextSnapshot = readResponsiveLayoutSnapshot()
  if (!isSameResponsiveLayoutSnapshot(currentSnapshot, nextSnapshot)) {
    currentSnapshot = nextSnapshot
  }

  return currentSnapshot
}

const emitIfChanged = () => {
  const nextSnapshot = readResponsiveLayoutSnapshot()
  if (isSameResponsiveLayoutSnapshot(currentSnapshot, nextSnapshot)) {
    return
  }

  currentSnapshot = nextSnapshot
  listeners.forEach(listener => listener())
}

const addMediaQueryListener = (mediaQuery: MediaQueryList, listener: () => void) => {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }

  mediaQuery.addListener(listener)
  return () => mediaQuery.removeListener(listener)
}

const ensureResponsiveLayoutListeners = () => {
  if (
    mediaListenersInstalled ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return
  }

  compactMediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY)
  touchMediaQuery = window.matchMedia(TOUCH_INTERACTION_QUERY)
  currentSnapshot = refreshResponsiveLayoutSnapshot()
  const removeCompactMediaQueryListener = addMediaQueryListener(compactMediaQuery, emitIfChanged)
  const removeTouchMediaQueryListener = addMediaQueryListener(touchMediaQuery, emitIfChanged)
  removeMediaQueryListeners = () => {
    removeCompactMediaQueryListener()
    removeTouchMediaQueryListener()
    compactMediaQuery = null
    touchMediaQuery = null
    mediaListenersInstalled = false
  }
  mediaListenersInstalled = true
}

const subscribeResponsiveLayout = (listener: () => void) => {
  ensureResponsiveLayoutListeners()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      removeMediaQueryListeners?.()
      removeMediaQueryListeners = null
    }
  }
}

const getResponsiveLayoutSnapshot = () => refreshResponsiveLayoutSnapshot()

export function useResponsiveLayout() {
  return useSyncExternalStore(
    subscribeResponsiveLayout,
    getResponsiveLayoutSnapshot,
    () => DEFAULT_RESPONSIVE_LAYOUT
  )
}
