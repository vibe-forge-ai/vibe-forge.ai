import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'

const PERMISSION_MODE_STORAGE_KEY = 'vf_chat_permission_mode'

export const isPermissionMode = (value: string): value is PermissionMode => {
  return value === 'default' ||
    value === 'acceptEdits' ||
    value === 'plan' ||
    value === 'dontAsk' ||
    value === 'bypassPermissions'
}

export function useChatPermissionMode() {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default')

  const updatePermissionMode = (value?: string) => {
    setPermissionMode(isPermissionMode(value ?? '') ? value : 'default')
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERMISSION_MODE_STORAGE_KEY)
      if (raw && isPermissionMode(raw)) {
        updatePermissionMode(raw)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PERMISSION_MODE_STORAGE_KEY, permissionMode)
    } catch {}
  }, [permissionMode])

  const permissionModeOptions = useMemo<Array<{ value: PermissionMode; label: ReactNode }>>(() => [
    { value: 'default', label: '默认' },
    { value: 'acceptEdits', label: '接受编辑' },
    { value: 'plan', label: '计划' },
    { value: 'dontAsk', label: '不询问' },
    { value: 'bypassPermissions', label: '跳过权限' }
  ], [])

  return {
    permissionMode,
    setPermissionMode: updatePermissionMode,
    permissionModeOptions
  }
}
