import type { ReactNode } from 'react'

import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/types'

import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { useComposerControlShortcuts } from '#~/hooks/chat/use-composer-control-shortcuts'
import { resolveSendShortcut } from '#~/utils/shortcutUtils'

export const useSenderShortcuts = ({
  enabled,
  isInlineEdit,
  isMac,
  isThinking,
  modelUnavailable,
  permissionModeOptions,
  referenceActions,
  selectOverlays
}: {
  enabled: boolean
  isInlineEdit: boolean
  isMac: boolean
  isThinking: boolean
  modelUnavailable?: boolean
  permissionModeOptions: Array<{ value: PermissionMode; label: ReactNode }>
  referenceActions: {
    closeReferenceActions: (options?: { restoreFocus?: boolean }) => void
    openPermissionShortcutMenu: () => void
  }
  selectOverlays: {
    openModelSelector: () => boolean
    openEffortSelector: () => boolean
    setShowModelSelect: (nextOpen: boolean) => void
    setShowEffortSelect: (nextOpen: boolean) => void
  }
}) => {
  const { data: configRes } = useSWR<ConfigResponse>('/api/config')
  const mergedShortcuts = configRes?.sources?.merged?.shortcuts
  const resolvedSendShortcut = resolveSendShortcut(mergedShortcuts?.sendMessage, isMac)

  const composerControlShortcuts = useComposerControlShortcuts({
    enabled,
    isMac,
    shortcuts: mergedShortcuts,
    onSwitchModel: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (selectOverlays.openModelSelector()) {
        referenceActions.closeReferenceActions()
      }
    },
    onSwitchEffort: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (selectOverlays.openEffortSelector()) {
        referenceActions.closeReferenceActions()
      }
    },
    onSwitchPermissionMode: (event) => {
      if (isInlineEdit || modelUnavailable || isThinking || permissionModeOptions.length === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      selectOverlays.setShowModelSelect(false)
      selectOverlays.setShowEffortSelect(false)
      referenceActions.openPermissionShortcutMenu()
    }
  })

  return {
    clearInputShortcut: mergedShortcuts?.clearInput,
    composerControlShortcuts,
    resolvedSendShortcut
  }
}
