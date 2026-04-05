import { useEffect, useMemo, useState } from 'react'

import type {
  MenuFocusTarget,
  ReferenceMenuKey,
  SenderInitialContent
} from '#~/components/chat/sender/@types/sender-types'
import { isActivationKey } from '#~/components/chat/sender/@utils/sender-utils'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useRovingFocusList } from '#~/hooks/use-roving-focus-list'

export const useSenderReferenceActions = ({
  initialContent,
  isInlineEdit,
  permissionMode,
  permissionModeValues,
  onPermissionSelect,
  onReferenceImageSelect,
  onOpenContextPicker
}: {
  initialContent: SenderInitialContent
  isInlineEdit: boolean
  permissionMode: PermissionMode
  permissionModeValues: PermissionMode[]
  onPermissionSelect: (mode: PermissionMode) => void
  onReferenceImageSelect: () => void
  onOpenContextPicker: () => void
}) => {
  const [showReferenceActions, setShowReferenceActions] = useState(false)
  const [showPermissionActions, setShowPermissionActions] = useState(false)
  const [menuFocusTarget, setMenuFocusTarget] = useState<MenuFocusTarget>(null)
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false)
  const referenceMenuKeys = useMemo<ReferenceMenuKey[]>(() => {
    const keys: ReferenceMenuKey[] = ['image']
    if (!isInlineEdit) {
      keys.push('file')
    }
    if (!isInlineEdit && permissionModeValues.length > 0) {
      keys.push('permission')
    }
    return keys
  }, [isInlineEdit, permissionModeValues.length])
  const referenceMenuNavigation = useRovingFocusList(referenceMenuKeys, 'image')
  const permissionMenuNavigation = useRovingFocusList(permissionModeValues, permissionMode)

  useEffect(() => {
    resetReferenceActions()
  }, [initialContent])

  useEffect(() => {
    if (permissionModeValues.includes(permissionMode)) {
      permissionMenuNavigation.setActiveKey(permissionMode)
    }
  }, [permissionMenuNavigation, permissionMode, permissionModeValues])

  useEffect(() => {
    if (menuFocusTarget !== 'reference' || !showReferenceActions || showPermissionActions) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      referenceMenuNavigation.focusKey(referenceMenuNavigation.activeKey ?? referenceMenuKeys[0] ?? null)
      setMenuFocusTarget(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [menuFocusTarget, referenceMenuKeys, referenceMenuNavigation, showPermissionActions, showReferenceActions])

  useEffect(() => {
    if (menuFocusTarget !== 'permission' || !showReferenceActions || !showPermissionActions) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      permissionMenuNavigation.focusKey(permissionMenuNavigation.activeKey ?? permissionMode)
      setMenuFocusTarget(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [menuFocusTarget, permissionMenuNavigation, permissionMode, showPermissionActions, showReferenceActions])

  const closeReferenceActions = ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    resetReferenceActions()
    setShouldRestoreFocus(restoreFocus)
  }

  const resetReferenceActions = () => {
    setShowReferenceActions(false)
    setShowPermissionActions(false)
    setMenuFocusTarget(null)
    setShouldRestoreFocus(false)
  }

  return {
    showReferenceActions,
    setShowReferenceActions,
    showPermissionActions,
    setShowPermissionActions,
    shouldRestoreFocus,
    clearReferenceFocusRestore: () => setShouldRestoreFocus(false),
    referenceMenuNavigation,
    permissionMenuNavigation,
    resetReferenceActions,
    closeReferenceActions,
    openPermissionShortcutMenu: () => {
      setShowReferenceActions(true)
      setShowPermissionActions(true)
      referenceMenuNavigation.setActiveKey('permission')
      permissionMenuNavigation.setActiveKey(permissionMode)
      setMenuFocusTarget('permission')
    },
    handleReferenceMenuKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, key: ReferenceMenuKey) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (key !== 'permission') {
          setShowPermissionActions(false)
        }
        referenceMenuNavigation.moveFocus(1, key)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (key !== 'permission') {
          setShowPermissionActions(false)
        }
        referenceMenuNavigation.moveFocus(-1, key)
        return
      }
      if (event.key === 'ArrowRight' && key === 'permission' && permissionModeValues.length > 0) {
        event.preventDefault()
        setShowPermissionActions(true)
        permissionMenuNavigation.setActiveKey(permissionMode)
        setMenuFocusTarget('permission')
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeReferenceActions({ restoreFocus: true })
        return
      }
      if (!isActivationKey(event.key)) {
        return
      }
      event.preventDefault()
      if (key === 'image') {
        closeReferenceActions()
        onReferenceImageSelect()
        return
      }
      if (key === 'file') {
        closeReferenceActions()
        onOpenContextPicker()
        return
      }
      setShowPermissionActions(prev => {
        const nextOpen = !prev
        if (nextOpen) {
          permissionMenuNavigation.setActiveKey(permissionMode)
          setMenuFocusTarget('permission')
        }
        return nextOpen
      })
    },
    handlePermissionMenuKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, key: PermissionMode) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        permissionMenuNavigation.moveFocus(1, key)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        permissionMenuNavigation.moveFocus(-1, key)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setShowPermissionActions(false)
        referenceMenuNavigation.setActiveKey('permission')
        setMenuFocusTarget('reference')
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeReferenceActions({ restoreFocus: true })
        return
      }
      if (!isActivationKey(event.key)) {
        return
      }
      event.preventDefault()
      onPermissionSelect(key)
      closeReferenceActions({ restoreFocus: true })
    }
  }
}
