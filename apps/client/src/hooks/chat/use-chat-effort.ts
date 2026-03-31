import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ChatEffort = 'default' | 'low' | 'medium' | 'high' | 'max'

const EFFORT_STORAGE_KEY = 'vf_chat_effort'

export const isChatEffort = (value: string): value is ChatEffort => {
  return value === 'default' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'max'
}

export function useChatEffort() {
  const [effort, setEffort] = useState<ChatEffort>('default')

  const updateEffort = (value?: string) => {
    if (value != null && isChatEffort(value)) {
      setEffort(value)
      return
    }
    setEffort('default')
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EFFORT_STORAGE_KEY)
      if (raw && isChatEffort(raw)) {
        updateEffort(raw)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(EFFORT_STORAGE_KEY, effort)
    } catch {}
  }, [effort])

  const effortOptions = useMemo<Array<{ value: ChatEffort; label: ReactNode }>>(() => [
    { value: 'default', label: '默认' },
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
    { value: 'max', label: '最高' }
  ], [])

  return {
    effort,
    setEffort: updateEffort,
    effortOptions
  }
}
