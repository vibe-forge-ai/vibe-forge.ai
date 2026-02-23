import './ArchiveView.scss'

import type { Session } from '@vibe-forge/core'
import { App, Button, Checkbox, Empty, Input, List, Popconfirm, Space, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { deleteSession, listSessions, updateSession } from '../api'

export function ArchiveView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { data: sessionsRes, mutate } = useSWR<{ sessions: Session[] }>(
    '/api/sessions/archived',
    async () => listSessions('archived')
  )
  const sessions: Session[] = sessionsRes?.sessions ?? []

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchMode, setIsBatchMode] = useState(false)

  const filteredSessions = useMemo(() => {
    if (searchQuery.trim() === '') return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter((s: Session): boolean => {
      const title = s.title ?? ''
      const lastMsg = s.lastMessage ?? ''
      const lastUserMsg = s.lastUserMessage ?? ''
      const tags = (s.tags ?? []).join(' ')
      const searchStr = `${title} ${s.id} ${lastMsg} ${lastUserMsg} ${tags}`.toLowerCase()
      return searchStr.includes(query)
    })
  }, [sessions, searchQuery])

  const handleRestore = async (id: string) => {
    try {
      await updateSession(id, { isArchived: false })
      void message.success(t('common.restoreSuccess', 'Restored successfully'))
      void mutate()
    } catch (err) {
      void message.error(t('common.restoreFailed', 'Failed to restore'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id)
      void message.success(t('common.deleteSuccess', 'Deleted successfully'))
      void mutate()
    } catch (err) {
      void message.error(t('common.deleteFailed', 'Failed to delete'))
    }
  }

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleBatchRestore = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id) => updateSession(id, { isArchived: false })))
      void message.success(t('common.batchRestoreSuccess', 'Batch restored successfully'))
      setSelectedIds(new Set())
      setIsBatchMode(false)
      void mutate()
    } catch (err) {
      void message.error(t('common.batchRestoreFailed', 'Failed to restore some sessions'))
    }
  }

  const handleBatchDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(async (id) => deleteSession(id)))
      void message.success(t('common.batchDeleteSuccess', 'Batch deleted successfully'))
      setSelectedIds(new Set())
      setIsBatchMode(false)
      void mutate()
    } catch (err) {
      void message.error(t('common.batchDeleteFailed', 'Failed to delete some sessions'))
    }
  }

  const isAllSelected = filteredSessions.length > 0 && selectedIds.size === filteredSessions.length

  return (
    <div className='archive-view'>
      <div className='archive-view__header'>
        <Space size={8} className='archive-view__title'>
          <h2 className='archive-view__title-text'>{t('common.archivedSessions')}</h2>
        </Space>

        <Space>
          {isBatchMode
            ? (
              <>
                <span className='archive-view__batch-info'>
                  {t('common.selectedCount', { count: selectedIds.size })}
                </span>
                <Tooltip title={t('common.cancel')}>
                  <Button
                    icon={
                      <span className='material-symbols-rounded archive-view__action-icon'>
                        close
                      </span>
                    }
                    onClick={() => {
                      setIsBatchMode(false)
                      setSelectedIds(new Set())
                    }}
                    className='archive-view__icon-button'
                  />
                </Tooltip>
                <Tooltip title={t('common.batchRestore')}>
                  <Button
                    type='primary'
                    icon={
                      <span className='material-symbols-rounded archive-view__action-icon'>
                        unarchive
                      </span>
                    }
                    onClick={() => {
                      void handleBatchRestore()
                    }}
                    disabled={selectedIds.size === 0}
                    className='archive-view__icon-button'
                  />
                </Tooltip>
                <Popconfirm
                  title={t('common.deleteConfirm', { count: selectedIds.size })}
                  onConfirm={() => {
                    void handleBatchDelete()
                  }}
                  disabled={selectedIds.size === 0}
                >
                  <Tooltip title={t('common.batchDelete')}>
                    <Button
                      danger
                      icon={
                        <span className='material-symbols-rounded archive-view__action-icon'>
                          delete_sweep
                        </span>
                      }
                      disabled={selectedIds.size === 0}
                      className='archive-view__icon-button'
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )
            : (
              <Tooltip title={t('common.batchMode')}>
                <Button
                  icon={
                    <span className='material-symbols-rounded archive-view__action-icon'>
                      checklist
                    </span>
                  }
                  onClick={() => setIsBatchMode(true)}
                  disabled={sessions.length === 0}
                  className='archive-view__icon-button'
                />
              </Tooltip>
            )}
        </Space>
      </div>

      <div className='archive-view__filter-bar'>
        {isBatchMode && (
          <div className='archive-view__select-all'>
            <Tooltip title={isAllSelected ? t('common.deselectAll') : t('common.selectAll')}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={selectedIds.size > 0 && selectedIds.size < filteredSessions.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </Tooltip>
          </div>
        )}
        <Input
          prefix={<span className='material-symbols-rounded archive-view__search-icon'>search</span>}
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          className='archive-view__search-input'
        />
      </div>

      <div className='archive-view__list'>
        {filteredSessions.length === 0
          ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={searchQuery ? t('common.noSessions') : t('common.noArchivedSessions')}
            />
          )
          : (
            <List
              itemLayout='horizontal'
              dataSource={filteredSessions}
              renderItem={(session) => (
                <List.Item
                  className={[
                    'archive-view__item',
                    selectedIds.has(session.id) ? 'archive-view__item--selected' : '',
                    isBatchMode ? 'archive-view__item--batch' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => isBatchMode && handleToggleSelect(session.id)}
                >
                  <div className='archive-view__item-row'>
                    {isBatchMode && (
                      <div className='archive-view__item-select'>
                        <Checkbox
                          checked={selectedIds.has(session.id)}
                          onChange={() => handleToggleSelect(session.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    <span className='material-symbols-rounded archive-view__item-icon'>
                      chat_bubble
                    </span>
                    <div className='archive-view__item-main'>
                      <span className='archive-view__item-title'>
                        {(session.title != null && session.title !== '')
                          ? session.title
                          : (session.lastMessage != null && session.lastMessage !== '')
                          ? session.lastMessage
                          : t('common.newChat')}
                      </span>
                      {session.tags && session.tags.length > 0 && (
                        <div className='archive-view__item-tags'>
                          {session.tags.map(tag => (
                            <Tag key={tag} className='archive-view__item-tag'>{tag}</Tag>
                          ))}
                        </div>
                      )}
                      <span className='archive-view__item-time'>
                        {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </div>

                    {!isBatchMode && (
                      <div className='archive-view__item-actions'>
                        <Tooltip title={t('common.restore')}>
                          <Button
                            type='text'
                            size='small'
                            className='archive-view__item-action-button'
                            icon={<span className='material-symbols-rounded archive-view__action-icon'>unarchive</span>}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRestore(session.id)
                            }}
                          />
                        </Tooltip>
                        <Popconfirm
                          title={t('common.deleteSessionConfirm')}
                          onConfirm={(e) => {
                            e?.stopPropagation()
                            void handleDelete(session.id)
                          }}
                        >
                          <Button
                            type='text'
                            size='small'
                            danger
                            className='archive-view__item-action-button'
                            icon={<span className='material-symbols-rounded archive-view__action-icon'>delete</span>}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
      </div>
    </div>
  )
}
