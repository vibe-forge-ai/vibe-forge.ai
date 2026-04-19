import './MessageContextMenu.scss'

import { App, Dropdown } from 'antd'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '@vibe-forge/core'

import { MessageContextMenuContent } from './MessageContextMenuContent'
import { buildMessageContextMenuEntries } from './build-message-context-menu-entries'

interface MessageContextMenuProps {
  anchorId: string
  canEdit: boolean
  canFork: boolean
  canRecall: boolean
  children: ReactElement
  copyableText?: string
  isDebugMode: boolean
  isEditing: boolean
  message: ChatMessage
  sessionId?: string
  trigger?: ('click' | 'contextMenu')[]
  onFork: () => void
  onRecall: () => void
  onStartEditing: () => void
}

type PendingMessageMenuAction = 'fork' | 'recall' | null

export function MessageContextMenu({
  anchorId,
  canEdit,
  canFork,
  canRecall,
  children,
  copyableText,
  isDebugMode,
  isEditing,
  message: sourceMessage,
  sessionId,
  trigger = ['contextMenu'],
  onFork,
  onRecall,
  onStartEditing
}: MessageContextMenuProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingMessageMenuAction>(null)

  const closeMenu = () => {
    setOpen(false)
    setPendingAction(null)
  }

  const handleConfirmableActionClick = (action: Exclude<PendingMessageMenuAction, null>) => {
    if (pendingAction === action) {
      closeMenu()
      if (action === 'recall') {
        void onRecall()
        return
      }
      void onFork()
      return
    }

    setPendingAction(action)
  }

  const entries = buildMessageContextMenuEntries({
    anchorId,
    canEdit,
    canFork,
    canRecall,
    copyableText,
    isDebugMode,
    isEditing,
    messageApi: message,
    onCloseMenu: closeMenu,
    onConfirmableActionClick: handleConfirmableActionClick,
    onStartEditing,
    sessionId,
    sourceMessage,
    t
  })

  return (
    <Dropdown
      trigger={trigger}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setPendingAction(null)
        }
      }}
      dropdownRender={() => (
        <MessageContextMenuContent
          entries={entries}
          pendingAction={pendingAction}
          onCancelConfirm={() => setPendingAction(null)}
        />
      )}
    >
      {children}
    </Dropdown>
  )
}
