import { App, Dropdown, Input } from 'antd'
import type { MenuProps } from 'antd'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { Session } from '@vibe-forge/core'

import { buildSessionUrl } from '#~/utils/chat-links.js'
import { copyTextWithFeedback } from '#~/utils/copy.js'

interface SessionContextMenuProps {
  children: ReactElement
  session: Session
  onArchive: (id: string) => void | Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onStar: (id: string, isStarred: boolean) => void | Promise<void>
}

export function SessionContextMenu({
  children,
  session,
  onArchive,
  onRename,
  onStar
}: SessionContextMenuProps) {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()

  const items = useMemo<MenuProps['items']>(() => {
    return [
      {
        key: 'star',
        label: session.isStarred ? t('common.unstar') : t('common.star'),
        icon: <span className='material-symbols-rounded'>{session.isStarred ? 'star' : 'star_border'}</span>,
        onClick: () => {
          void onStar(session.id, !session.isStarred)
        }
      },
      {
        key: 'rename',
        label: t('common.rename'),
        icon: <span className='material-symbols-rounded'>edit</span>,
        onClick: () => {
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
        icon: <span className='material-symbols-rounded'>{session.isArchived ? 'unarchive' : 'archive'}</span>,
        onClick: () => {
          void onArchive(session.id)
        }
      },
      { type: 'divider' },
      {
        key: 'copy-session-link',
        label: t('common.copySessionLink'),
        icon: <span className='material-symbols-rounded'>link</span>,
        onClick: () => {
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
        icon: <span className='material-symbols-rounded'>fingerprint</span>,
        onClick: () => {
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
        icon: <span className='material-symbols-rounded'>terminal</span>,
        onClick: () => {
          void copyTextWithFeedback({
            text: `vf --resume ${session.id}`,
            messageApi: message,
            successMessage: t('common.resumeCommandCopied'),
            failureMessage: t('common.copyFailed')
          })
        }
      }
    ]
  }, [message, modal, onArchive, onRename, onStar, session, t])

  return (
    <Dropdown menu={{ items }} trigger={['contextMenu']}>
      {children}
    </Dropdown>
  )
}
