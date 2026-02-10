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
    <div style={{ padding: '24px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={12}>
          <span className='material-symbols-rounded' style={{ fontSize: '28px', color: '#6b7280' }}>
            archive
          </span>
          <h2 style={{ margin: 0 }}>{t('common.archivedSessions')}</h2>
        </Space>

        <Space>
          {isBatchMode
            ? (
              <>
                <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '8px' }}>
                  {t('common.selectedCount', { count: selectedIds.size })}
                </span>
                <Tooltip title={t('common.cancel')}>
                  <Button
                    icon={
                      <span
                        className='material-symbols-rounded'
                        style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        close
                      </span>
                    }
                    onClick={() => {
                      setIsBatchMode(false)
                      setSelectedIds(new Set())
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  />
                </Tooltip>
                <Tooltip title={t('common.batchRestore')}>
                  <Button
                    type='primary'
                    icon={
                      <span
                        className='material-symbols-rounded'
                        style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        unarchive
                      </span>
                    }
                    onClick={() => {
                      void handleBatchRestore()
                    }}
                    disabled={selectedIds.size === 0}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
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
                        <span
                          className='material-symbols-rounded'
                          style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          delete_sweep
                        </span>
                      }
                      disabled={selectedIds.size === 0}
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )
            : (
              <Tooltip title={t('common.batchMode')}>
                <Button
                  icon={
                    <span
                      className='material-symbols-rounded'
                      style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      checklist
                    </span>
                  }
                  onClick={() => setIsBatchMode(true)}
                  disabled={sessions.length === 0}
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                />
              </Tooltip>
            )}
        </Space>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isBatchMode && (
          <div
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
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
          prefix={
            <span className='material-symbols-rounded' style={{ fontSize: '18px', color: '#9ca3af' }}>search</span>
          }
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ flex: 1 }}>
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
                  style={{
                    padding: '8px 0',
                    background: selectedIds.has(session.id) ? '#f5f5f5' : 'transparent',
                    cursor: isBatchMode ? 'pointer' : 'default',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                  onClick={() => isBatchMode && handleToggleSelect(session.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
                    {isBatchMode && (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Checkbox
                          checked={selectedIds.has(session.id)}
                          onChange={() => handleToggleSelect(session.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    <span
                      className='material-symbols-rounded'
                      style={{ fontSize: '20px', color: '#9ca3af', flexShrink: 0 }}
                    >
                      chat_bubble
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {(session.title != null && session.title !== '')
                          ? session.title
                          : (session.lastMessage != null && session.lastMessage !== '')
                          ? session.lastMessage
                          : t('common.newChat')}
                      </span>
                      {session.tags && session.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          {session.tags.map(tag => (
                            <Tag key={tag} style={{ fontSize: '11px', borderRadius: '2px', margin: 0 }}>{tag}</Tag>
                          ))}
                        </div>
                      )}
                      <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>
                        {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </div>

                    {!isBatchMode && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <Tooltip title={t('common.restore')}>
                          <Button
                            type='text'
                            size='small'
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              padding: 0
                            }}
                            icon={
                              <span className='material-symbols-rounded' style={{ fontSize: '18px' }}>unarchive</span>
                            }
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
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              padding: 0
                            }}
                            icon={<span className='material-symbols-rounded' style={{ fontSize: '18px' }}>delete</span>}
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
