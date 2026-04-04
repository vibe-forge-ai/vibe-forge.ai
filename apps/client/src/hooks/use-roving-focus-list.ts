import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const getLoopedIndex = (
  currentIndex: number,
  delta: number,
  itemCount: number
) => {
  if (itemCount <= 0) {
    return -1
  }

  const nextIndex = (currentIndex + delta) % itemCount
  return nextIndex < 0 ? nextIndex + itemCount : nextIndex
}

export const useRovingFocusList = <T extends string>(
  keys: T[],
  initialKey?: T | null
) => {
  const itemRefs = useRef(new Map<T, HTMLElement>())
  const [activeKey, setActiveKey] = useState<T | null>(() => {
    if (initialKey != null && keys.includes(initialKey)) {
      return initialKey
    }
    return keys[0] ?? null
  })

  useEffect(() => {
    if (keys.length === 0) {
      setActiveKey(null)
      return
    }

    if (activeKey != null && keys.includes(activeKey)) {
      return
    }

    if (initialKey != null && keys.includes(initialKey)) {
      setActiveKey(initialKey)
      return
    }

    setActiveKey(keys[0] ?? null)
  }, [activeKey, initialKey, keys])

  const registerItem = useCallback((key: T) => {
    return (node: HTMLElement | null) => {
      if (node == null) {
        itemRefs.current.delete(key)
        return
      }
      itemRefs.current.set(key, node)
    }
  }, [])

  const focusKey = useCallback((key: T | null) => {
    if (key == null) {
      return
    }
    setActiveKey(key)
    itemRefs.current.get(key)?.focus()
  }, [])

  const keyIndexMap = useMemo(() => {
    return new Map(keys.map((key, index) => [key, index]))
  }, [keys])

  const moveFocus = useCallback((delta: number, fromKey?: T | null) => {
    if (keys.length === 0) {
      return null
    }

    const sourceKey = fromKey ?? activeKey ?? keys[0] ?? null
    const sourceIndex = sourceKey == null ? 0 : (keyIndexMap.get(sourceKey) ?? 0)
    const nextIndex = getLoopedIndex(sourceIndex, delta, keys.length)
    const nextKey = keys[nextIndex] ?? null
    if (nextKey != null) {
      focusKey(nextKey)
    }
    return nextKey
  }, [activeKey, focusKey, keyIndexMap, keys])

  const focusFirst = useCallback(() => {
    const firstKey = keys[0] ?? null
    focusKey(firstKey)
    return firstKey
  }, [focusKey, keys])

  const focusLast = useCallback(() => {
    const lastKey = keys.at(-1) ?? null
    focusKey(lastKey)
    return lastKey
  }, [focusKey, keys])

  return {
    activeKey,
    setActiveKey,
    registerItem,
    focusKey,
    moveFocus,
    focusFirst,
    focusLast
  }
}
