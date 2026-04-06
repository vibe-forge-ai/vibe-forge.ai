import { App, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '@vibe-forge/core'

import { buildSessionUrl } from '#~/utils/chat-links.js'
import { copyTextWithFeedback } from '#~/utils/copy.js'

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
  onFork: () => void
  onRecall: () => void
  onStartEditing: () => void
}

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
  onFork,
  onRecall,
  onStartEditing
}: MessageContextMenuProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const items = useMemo<MenuProps['items']>(() => {
    const nextItems: NonNullable<MenuProps['items']> = []

    if (copyableText != null) {
      nextItems.push({
        key: 'copy',
        label: t('chat.messageActions.copy'),
        icon: <span className='material-symbols-rounded'>content_copy</span>,
        onClick: () => {
          void copyTextWithFeedback({
            text: copyableText,
            messageApi: message,
            successMessage: t('chat.messageActions.copySuccess'),
            failureMessage: t('chat.messageActions.copyFailed')
          })
        }
      })
    }

    if (canEdit && !isEditing) {
      nextItems.push({
        key: 'edit',
        label: t('chat.messageActions.edit'),
        icon: <span className='material-symbols-rounded'>edit</span>,
        onClick: onStartEditing
      })
    }

    if (canRecall) {
      nextItems.push({
        key: 'recall',
        label: t('chat.messageActions.recall'),
        icon: <span className='material-symbols-rounded'>undo</span>,
        onClick: () => {
          onRecall()
        }
      })
    }

    if (canFork) {
      nextItems.push({
        key: 'fork',
        label: t('chat.messageActions.fork'),
        icon: <span className='material-symbols-rounded'>fork_right</span>,
        onClick: () => {
          onFork()
        }
      })
    }

    if (nextItems.length > 0) {
      nextItems.push({ type: 'divider' })
    }

    if (sessionId != null && sessionId !== '') {
      nextItems.push({
        key: 'copy-link',
        label: t('chat.messageActions.copyLink'),
        icon: <span className='material-symbols-rounded'>link</span>,
        onClick: () => {
          void copyTextWithFeedback({
            text: buildSessionUrl(sessionId, { anchorId }),
            messageApi: message,
            successMessage: t('chat.messageActions.copyLinkSuccess'),
            failureMessage: t('chat.messageActions.copyFailed')
          })
        }
      })
    }

    nextItems.push({
      key: 'copy-id',
      label: t('chat.messageActions.copyId'),
      icon: <span className='material-symbols-rounded'>fingerprint</span>,
      onClick: () => {
        void copyTextWithFeedback({
          text: sourceMessage.id,
          messageApi: message,
          successMessage: t('chat.messageActions.copyIdSuccess'),
          failureMessage: t('chat.messageActions.copyFailed')
        })
      }
    })

    if (isDebugMode) {
      nextItems.push(
        { type: 'divider' },
        {
          key: 'copy-json',
          label: t('chat.messageActions.copyJson'),
          icon: <span className='material-symbols-rounded'>data_object</span>,
          onClick: () => {
            void copyTextWithFeedback({
              text: JSON.stringify(sourceMessage, null, 2),
              messageApi: message,
              successMessage: t('chat.messageActions.copyJsonSuccess'),
              failureMessage: t('chat.messageActions.copyFailed')
            })
          }
        },
        {
          key: 'copy-timestamp',
          label: t('chat.messageActions.copyTimestamp'),
          icon: <span className='material-symbols-rounded'>schedule</span>,
          onClick: () => {
            void copyTextWithFeedback({
              text: String(sourceMessage.createdAt),
              messageApi: message,
              successMessage: t('chat.messageActions.copyTimestampSuccess'),
              failureMessage: t('chat.messageActions.copyFailed')
            })
          }
        }
      )
    }

    return nextItems
  }, [
    anchorId,
    canEdit,
    canFork,
    canRecall,
    copyableText,
    isDebugMode,
    isEditing,
    message,
    onFork,
    onRecall,
    onStartEditing,
    sessionId,
    sourceMessage,
    t
  ])

  return (
    <Dropdown menu={{ items }} trigger={['contextMenu']}>
      {children}
    </Dropdown>
  )
}
