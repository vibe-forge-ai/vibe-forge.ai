import type { ChatMessage } from '@vibe-forge/core'

import { buildSessionUrl } from '#~/utils/chat-links.js'
import { copyTextWithFeedback } from '#~/utils/copy.js'
import type { MessageContextMenuEntry } from './MessageContextMenuContent'

type PendingMessageMenuAction = 'fork' | 'recall' | null

export function buildMessageContextMenuEntries({
  anchorId,
  canEdit,
  canFork,
  canRecall,
  copyableText,
  isDebugMode,
  isEditing,
  messageApi,
  onConfirmableActionClick,
  onStartEditing,
  sessionId,
  sourceMessage,
  t
}: {
  anchorId: string
  canEdit: boolean
  canFork: boolean
  canRecall: boolean
  copyableText?: string
  isDebugMode: boolean
  isEditing: boolean
  messageApi: {
    error: (content: string) => void
    success: (content: string) => void
  }
  onConfirmableActionClick: (action: Exclude<PendingMessageMenuAction, null>) => void
  onStartEditing: () => void
  sessionId?: string
  sourceMessage: ChatMessage
  t: (key: string, options?: Record<string, unknown>) => string
}): MessageContextMenuEntry[] {
  const entries: MessageContextMenuEntry[] = []

  const closeWithCopy = (text: string, successMessage: string) => {
    void copyTextWithFeedback({
      text,
      messageApi,
      successMessage,
      failureMessage: t('chat.messageActions.copyFailed')
    })
  }

  if (copyableText != null) {
    entries.push({
      key: 'copy',
      label: t('chat.messageActions.copy'),
      icon: 'content_copy',
      onClick: () => {
        closeWithCopy(copyableText, t('chat.messageActions.copySuccess'))
      }
    })
  }

  if (canEdit && !isEditing) {
    entries.push({
      key: 'edit',
      label: t('chat.messageActions.edit'),
      icon: 'edit',
      onClick: onStartEditing
    })
  }

  if (canRecall) {
    entries.push({
      key: 'recall',
      label: t('chat.messageActions.recall'),
      confirmLabel: t('common.confirmAction', {
        action: t('chat.messageActions.recall')
      }),
      icon: 'undo',
      danger: true,
      onClick: () => {
        onConfirmableActionClick('recall')
      }
    })
  }

  if (canFork) {
    entries.push({
      key: 'fork',
      label: t('chat.messageActions.fork'),
      confirmLabel: t('common.confirmAction', {
        action: t('chat.messageActions.fork')
      }),
      icon: 'fork_right',
      onClick: () => {
        onConfirmableActionClick('fork')
      }
    })
  }

  if (entries.length > 0) {
    entries.push({
      key: 'divider-primary',
      type: 'divider',
      label: '',
      icon: '',
      onClick: () => undefined
    })
  }

  if (sessionId != null && sessionId !== '') {
    entries.push({
      key: 'copy-link',
      label: t('chat.messageActions.copyLink'),
      icon: 'link',
      onClick: () => {
        closeWithCopy(buildSessionUrl(sessionId, { anchorId }), t('chat.messageActions.copyLinkSuccess'))
      }
    })
  }

  entries.push({
    key: 'copy-id',
    label: t('chat.messageActions.copyId'),
    icon: 'fingerprint',
    onClick: () => {
      closeWithCopy(sourceMessage.id, t('chat.messageActions.copyIdSuccess'))
    }
  })

  if (isDebugMode) {
    entries.push(
      {
        key: 'divider-debug',
        type: 'divider',
        label: '',
        icon: '',
        onClick: () => undefined
      },
      {
        key: 'copy-json',
        label: t('chat.messageActions.copyJson'),
        icon: 'data_object',
        onClick: () => {
          closeWithCopy(JSON.stringify(sourceMessage, null, 2), t('chat.messageActions.copyJsonSuccess'))
        }
      },
      {
        key: 'copy-timestamp',
        label: t('chat.messageActions.copyTimestamp'),
        icon: 'schedule',
        onClick: () => {
          closeWithCopy(String(sourceMessage.createdAt), t('chat.messageActions.copyTimestampSuccess'))
        }
      }
    )
  }

  return entries
}
