import { useEffect, useMemo, useState } from 'react'

import type { ReferenceMenuKey, SenderInitialContent } from '#~/components/chat/sender/@types/sender-types'
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
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false)
  const referenceMenuKeys = useMemo<ReferenceMenuKey[]>(() => {
    const keys: ReferenceMenuKey[] = ['image']
    if (!isInlineEdit) {
      keys.push('file')
    }
    return keys
  }, [isInlineEdit])
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

  const closeReferenceActions = ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    resetReferenceActions()
    setShouldRestoreFocus(restoreFocus)
  }

  const resetReferenceActions = () => {
    setShowReferenceActions(false)
    setShowPermissionActions(false)
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
      setShowReferenceActions(false)
      setShowPermissionActions(true)
      permissionMenuNavigation.setActiveKey(permissionMode)
      window.requestAnimationFrame(() => {
        permissionMenuNavigation.focusKey(permissionMenuNavigation.activeKey ?? permissionMode)
      })
    },
    handleReferenceMenuKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, key: ReferenceMenuKey) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setShowPermissionActions(false)
        referenceMenuNavigation.moveFocus(1, key)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setShowPermissionActions(false)
        referenceMenuNavigation.moveFocus(-1, key)
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
      }
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
      if (event.key === 'ArrowLeft' || event.key === 'Escape') {
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
