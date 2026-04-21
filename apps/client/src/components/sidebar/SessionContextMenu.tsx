import './SessionContextMenu.scss'

import { App, Dropdown, Input } from 'antd'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'

import { buildSessionUrl } from '#~/utils/chat-links.js'
import { copyTextWithFeedback } from '#~/utils/copy.js'
import { SessionContextMenuContent } from './SessionContextMenuContent'
import type { SessionContextMenuEntry } from './SessionContextMenuContent'

interface SessionContextMenuProps {
  children: ReactElement
  session: Session
  trigger?: ('click' | 'contextMenu')[]
  onArchive: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onStar: (id: string, isStarred: boolean) => void | Promise<void>
}

type PendingSessionMenuAction = 'archive' | 'delete' | null

export function SessionContextMenu({
  children,
  session,
  trigger = ['contextMenu'],
  onArchive,
  onDelete,
  onRename,
  onStar
}: SessionContextMenuProps) {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const [open, setOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingSessionMenuAction>(null)

  const closeMenu = () => {
    setOpen(false)
    setPendingAction(null)
  }

  const handleConfirmableActionClick = (action: Exclude<PendingSessionMenuAction, null>) => {
    if (pendingAction === action) {
      closeMenu()
      if (action === 'archive') {
        void onArchive(session.id)
        return
      }
      void onDelete(session.id)
      return
    }

    setPendingAction(action)
  }

  const entries = useMemo<SessionContextMenuEntry[]>(() => {
    return [
      {
        key: 'star',
        label: session.isStarred ? t('common.unstar') : t('common.star'),
        icon: session.isStarred ? 'star' : 'star_border',
        onClick: () => {
          closeMenu()
          void onStar(session.id, !session.isStarred)
        }
      },
      {
        key: 'rename',
        label: t('common.rename'),
        icon: 'edit',
        onClick: () => {
          closeMenu()
          let nextTitle = session.title ?? ''

          modal.confirm({
            title: t('common.renameSession'),
            okText: t('common.confirm'),
            cancelText: t('common.cancel'),
            content: (
              <Input
                autoFocus
                defaultValue={session.title ?? ''}
                placeholder={t('chat.enterTitle')}
                onChange={(event) => {
                  nextTitle = event.target.value
                }}
              />
            ),
            onOk: async () => {
              const normalizedTitle = nextTitle.trim()
              if (normalizedTitle === (session.title ?? '').trim()) {
                return
              }

              try {
                await onRename(session.id, normalizedTitle)
                void message.success(t('chat.titleUpdated'))
              } catch {
                void message.error(t('common.operationFailed'))
                throw new Error('rename-session-failed')
              }
            }
          })
        }
      },
      {
        key: 'archive',
        label: session.isArchived ? t('common.restore') : t('common.archive'),
        confirmLabel: t('common.confirmAction', {
          action: session.isArchived ? t('common.restore') : t('common.archive')
        }),
        icon: session.isArchived ? 'unarchive' : 'archive',
        onClick: () => {
          handleConfirmableActionClick('archive')
        }
      },
      {
        key: 'delete',
        label: t('common.delete'),
        confirmLabel: t('common.confirmAction', { action: t('common.delete') }),
        icon: 'delete',
        danger: true,
        onClick: () => {
          handleConfirmableActionClick('delete')
        }
      },
      { key: 'divider-main', type: 'divider', label: '', icon: '', onClick: () => undefined },
      {
        key: 'copy-session-link',
        label: t('common.copySessionLink'),
        icon: 'link',
        onClick: () => {
          closeMenu()
          void copyTextWithFeedback({
            text: buildSessionUrl(session.id),
            messageApi: message,
            successMessage: t('common.sessionLinkCopied'),
            failureMessage: t('common.copyFailed')
          })
        }
      },
      {
        key: 'copy-session-id',
        label: t('common.copySessionId'),
        icon: 'fingerprint',
        onClick: () => {
          closeMenu()
          void copyTextWithFeedback({
            text: session.id,
            messageApi: message,
            successMessage: t('common.sessionIdCopied'),
            failureMessage: t('common.copyFailed')
          })
        }
      },
      {
        key: 'copy-resume-command',
        label: t('common.copyResumeCommand'),
        icon: 'terminal',
        onClick: () => {
          closeMenu()
          void copyTextWithFeedback({
            text: `vf --resume ${session.id}`,
            messageApi: message,
            successMessage: t('common.resumeCommandCopied'),
            failureMessage: t('common.copyFailed')
          })
        }
      }
    ]
  }, [message, modal, onArchive, onDelete, onRename, onStar, pendingAction, session, t])

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
        <SessionContextMenuContent
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
