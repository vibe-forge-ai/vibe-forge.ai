import './SessionItem.scss'

import type { Session, SessionStatus } from '@vibe-forge/core'
import { Button, List, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getAdapterDisplay } from '#~/resources/adapters.js'
import { SessionContextMenu } from './SessionContextMenu'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

interface SessionItemProps {
  session: Session
  isActive: boolean
  isBatchMode: boolean
  isCompactLayout: boolean
  isSelected: boolean
  isTouchInteraction: boolean
  onSelect: (session: Session) => void
  onArchive: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  onStar: (id: string, isStarred: boolean) => void | Promise<void>
  onToggleSelect: (id: string) => void
}

type PendingSessionAction = 'archive' | null

export function SessionItem({
  session,
  isActive,
  isBatchMode,
  isCompactLayout,
  isSelected,
  isTouchInteraction,
  onSelect,
  onArchive,
  onDelete,
  onRename,
  onStar,
  onToggleSelect
}: SessionItemProps) {
  const { t, i18n } = useTranslation()
  const automationPrefix = 'automation:'
  const itemContentRef = useRef<HTMLDivElement | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingSessionAction>(null)
  const showCompactActionMenu = isCompactLayout || isTouchInteraction
  const resolveTooltipTitle = (title: string) => isTouchInteraction ? undefined : title

  useEffect(() => {
    if (pendingAction == null) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const nextTarget = event.target
      if (!(nextTarget instanceof Node)) {
        setPendingAction(null)
        return
      }

      if (!itemContentRef.current?.contains(nextTarget)) {
        setPendingAction(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [pendingAction])

  const timeDisplay = useMemo(() => {
    const d = dayjs(session.createdAt)
    if (i18n.language === 'zh') {
      d.locale('zh-cn')
    } else {
      d.locale('en')
    }
    return {
      relative: d.fromNow(),
      full: d.format('YYYY-MM-DD HH:mm:ss')
    }
  }, [session.createdAt, i18n.language])

  const archiveActionLabel = session.isArchived ? t('common.restore') : t('common.archive')
  const archiveConfirmLabel = t('common.confirmAction', { action: archiveActionLabel })
  const sessionTags = session.tags ?? []
  const visibleTags = isCompactLayout ? sessionTags.slice(0, 1) : sessionTags
  const hiddenTagCount = Math.max(sessionTags.length - visibleTags.length, 0)

  const displayTitle = (session.title != null && session.title !== '')
    ? session.title
    : (session.lastUserMessage != null && session.lastUserMessage !== '')
    ? session.lastUserMessage
    : t('common.newChat')
  const adapterDisplay = session.adapter != null && session.adapter !== ''
    ? getAdapterDisplay(session.adapter)
    : undefined

  const lastMessageSnippet = useMemo(() => {
    if (session.lastMessage == null || session.lastMessage === '') return null
    return session.lastMessage.length > 60 ? `${session.lastMessage.slice(0, 60)}...` : session.lastMessage
  }, [session.lastMessage])

  const parseAutomationTag = useMemo(() => {
    return (tag: string) => {
      if (!tag.startsWith(automationPrefix)) return null
      const parts = tag.split(':')
      if (parts.length < 3) return null
      return {
        ruleId: parts[1],
        ruleTitle: parts.slice(2).join(':')
      }
    }
  }, [automationPrefix])

  const getStatusIcon = (status?: SessionStatus) => {
    if (!status) {
      return <div className={`status-dot ${isActive ? 'active' : ''}`} />
    }

    let icon = ''
    let color = ''
    const title = t(`common.status.${status}`)

    switch (status) {
      case 'completed':
        icon = 'check_circle'
        color = '#52c41a' // Green
        break
      case 'terminated':
        icon = 'remove_circle'
        color = '#bfbfbf' // Grey
        break
      case 'failed':
        icon = 'cancel'
        color = '#ff4d4f' // Red
        break
      case 'running':
        icon = 'sync'
        color = '#1890ff' // Blue
        break
      case 'waiting_input':
        return (
          <Tooltip title={resolveTooltipTitle(title)}>
            <div className='waiting-input-indicator' />
          </Tooltip>
        )
      default:
        return <div className={`status-dot ${isActive ? 'active' : ''}`} />
    }

    return (
      <Tooltip title={resolveTooltipTitle(title)}>
        <span
          className={`material-symbols-rounded status-icon ${status === 'running' ? 'spin' : ''}`}
          style={{
            color,
            fontSize: '16px',
            lineHeight: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </span>
      </Tooltip>
    )
  }

  const handleConfirmableActionClick = (action: Exclude<PendingSessionAction, null>) => {
    if (pendingAction === action) {
      setPendingAction(null)
      void onArchive(session.id)
      return
    }

    setPendingAction(action)
  }

  return (
    <SessionContextMenu
      session={session}
      onArchive={onArchive}
      onDelete={onDelete}
      onRename={onRename}
      onStar={onStar}
    >
      <List.Item
        onClick={() => isBatchMode ? onToggleSelect(session.id) : onSelect(session)}
        onMouseLeave={() => setPendingAction(null)}
        onDoubleClick={() => {
          // eslint-disable-next-line no-console
          console.log('Session Details:', session)
        }}
        className={`session-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${
          session.isStarred ? 'starred' : ''
        } ${isCompactLayout ? 'session-item--compact' : ''} ${showCompactActionMenu ? 'session-item--touch' : ''}`}
      >
        <div ref={itemContentRef} className='session-item-content'>
          <div className={`session-leading ${adapterDisplay?.icon != null ? 'has-adapter' : ''}`}>
            {adapterDisplay?.icon != null && (
              <img
                className='session-adapter-icon'
                src={adapterDisplay.icon}
                alt=''
                aria-hidden='true'
              />
            )}
            <div className={`status-indicator ${adapterDisplay?.icon != null ? 'is-overlay' : ''}`}>
              {getStatusIcon(session.status)}
            </div>
          </div>
          <div className={`session-info ${isBatchMode ? '' : 'with-actions'}`}>
            <div className='session-header'>
              <div className='session-title'>
                <span className='session-title-text'>
                  {displayTitle}
                </span>
              </div>
              <div className='session-header-side'>
                {!isBatchMode && (
                  <>
                    {!isCompactLayout && (
                      <Tooltip title={resolveTooltipTitle(timeDisplay.full)}>
                        <span className='time-display'>
                          {timeDisplay.relative}
                        </span>
                      </Tooltip>
                    )}
                    {showCompactActionMenu
                      ? (
                        <SessionContextMenu
                          session={session}
                          trigger={['click']}
                          onArchive={onArchive}
                          onDelete={onDelete}
                          onRename={onRename}
                          onStar={onStar}
                        >
                          <Button
                            type='text'
                            size='small'
                            className='action-btn action-btn--more'
                            title={t('common.moreActions')}
                            aria-label={t('common.moreActions')}
                            onClick={(event) => {
                              event.stopPropagation()
                            }}
                            icon={<span className='material-symbols-rounded'>more_horiz</span>}
                          />
                        </SessionContextMenu>
                      )
                      : (
                        <div className='session-item-actions'>
                          <Tooltip
                            title={resolveTooltipTitle(session.isStarred ? t('common.unstar') : t('common.star'))}
                          >
                            <Button
                              type='text'
                              size='small'
                              className={`action-btn star-btn ${session.isStarred ? 'starred' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPendingAction(null)
                                void onStar(session.id, !session.isStarred)
                              }}
                              icon={
                                <span
                                  className={`material-symbols-rounded ${session.isStarred ? 'filled' : ''}`}
                                >
                                  star
                                </span>
                              }
                            />
                          </Tooltip>
                          <Tooltip
                            title={resolveTooltipTitle(
                              pendingAction === 'archive' ? archiveConfirmLabel : archiveActionLabel
                            )}
                          >
                            <Button
                              type='text'
                              size='small'
                              className={`action-btn archive-btn ${pendingAction === 'archive' ? 'is-confirming' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleConfirmableActionClick('archive')
                              }}
                            >
                              <span className='material-symbols-rounded'>
                                {session.isArchived ? 'unarchive' : 'archive'}
                              </span>
                              {pendingAction === 'archive' && (
                                <span className='action-btn__label'>{archiveConfirmLabel}</span>
                              )}
                            </Button>
                          </Tooltip>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
            {!isCompactLayout && lastMessageSnippet != null && (
              <div className='last-message'>
                {lastMessageSnippet}
              </div>
            )}
            {visibleTags.length > 0 && (
              <div className='tags-container'>
                {visibleTags.map((tag: string) => {
                  const automationTag = parseAutomationTag(tag)
                  if (automationTag) {
                    const href = `/automation?rule=${encodeURIComponent(automationTag.ruleId)}`
                    return (
                      <Tooltip
                        key={tag}
                        title={resolveTooltipTitle(automationTag.ruleTitle)}
                      >
                        <Tag
                          className='session-tag session-tag--automation'
                          onClick={(event) => event.stopPropagation()}
                        >
                          <a
                            className='session-tag__link'
                            href={href}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {automationTag.ruleTitle}
                          </a>
                        </Tag>
                      </Tooltip>
                    )
                  }
                  return (
                    <Tooltip
                      key={tag}
                      title={resolveTooltipTitle(tag)}
                    >
                      <Tag className='session-tag'>
                        <span className='session-tag__text'>
                          {tag}
                        </span>
                      </Tag>
                    </Tooltip>
                  )
                })}
                {hiddenTagCount > 0 && (
                  <Tag className='session-tag session-tag--count'>
                    +{hiddenTagCount}
                  </Tag>
                )}
              </div>
            )}
          </div>
        </div>
      </List.Item>
    </SessionContextMenu>
  )
}
