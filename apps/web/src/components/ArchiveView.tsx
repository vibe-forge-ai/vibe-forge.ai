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
  const { data: sessionsRes, mutate } = useSWR('/api/sessions/archived', async () => listSessions('archived'))
  const sessions = sessionsRes?.sessions ?? []

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchMode, setIsBatchMode] = useState(false)

  const filteredSessions = useMemo(() => {
    if (searchQuery.trim() === '') return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter(s =>
      (s.title ?? '').toLowerCase().includes(query)
      || s.id.toLowerCase().includes(query)
      || (s.lastMessage ?? '').toLowerCase().includes(query)
      || (s.lastUserMessage ?? '').toLowerCase().includes(query)
      || s.tags?.some(tag => tag.toLowerCase().includes(query))
    )
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

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={12}>
          <span className='material-symbols-outlined' style={{ fontSize: '28px', color: '#6b7280' }}>
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
                <Button
                  onClick={() => {
                    setIsBatchMode(false)
                    setSelectedIds(new Set())
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type='primary'
                  onClick={() => {
                    void handleBatchRestore()
                  }}
                  disabled={selectedIds.size === 0}
                >
                  {t('common.batchRestore')}
                </Button>
                <Popconfirm
                  title={t('common.deleteConfirm', { count: selectedIds.size })}
                  onConfirm={() => {
                    void handleBatchDelete()
                  }}
                  disabled={selectedIds.size === 0}
                >
                  <Button
                    danger
                    disabled={selectedIds.size === 0}
                  >
                    {t('common.batchDelete')}
                  </Button>
                </Popconfirm>
              </>
            )
            : (
              <Button onClick={() => setIsBatchMode(true)} disabled={sessions.length === 0}>
                {t('common.batchMode')}
              </Button>
            )}
        </Space>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Input
          prefix={
            <span className='material-symbols-outlined' style={{ fontSize: '18px', color: '#9ca3af' }}>search</span>
          }
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
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
                    padding: '16px',
                    background: selectedIds.has(session.id) ? '#f0f7ff' : 'transparent',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: '1px solid #f0f0f0',
                    cursor: isBatchMode ? 'pointer' : 'default'
                  }}
                  onClick={() => isBatchMode && handleToggleSelect(session.id)}
                  actions={!isBatchMode
                    ? [
                      <Tooltip title={t('common.restore')} key='restore'>
                        <span>
                          <Button
                            type='text'
                            icon={
                              <span className='material-symbols-outlined' style={{ fontSize: '20px' }}>unarchive</span>
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRestore(session.id)
                            }}
                          />
                        </span>
                      </Tooltip>,
                      <Popconfirm
                        key='delete'
                        title={t('common.deleteSessionConfirm')}
                        onConfirm={(e) => {
                          e?.stopPropagation()
                          void handleDelete(session.id)
                        }}
                      >
                        <Button
                          type='text'
                          danger
                          icon={<span className='material-symbols-outlined' style={{ fontSize: '20px' }}>delete</span>}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    ]
                    : []}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {isBatchMode && (
                      <Checkbox
                        checked={selectedIds.has(session.id)}
                        style={{ marginRight: '16px' }}
                        onChange={() => handleToggleSelect(session.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                    <List.Item.Meta
                      avatar={
                        <span
                          className='material-symbols-outlined'
                          style={{ fontSize: '24px', color: '#9ca3af', marginTop: '4px' }}
                        >
                          chat_bubble
                        </span>
                      }
                      title={
                        <span style={{ fontWeight: 500 }}>
                          {(session.title != null && session.title !== '')
                            ? session.title
                            : (session.lastMessage != null && session.lastMessage !== '')
                            ? session.lastMessage
                            : t('common.newChat')}
                        </span>
                      }
                      description={
                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {dayjs(session.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                          {session.tags && session.tags.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              {session.tags.map(tag => (
                                <Tag key={tag} style={{ fontSize: '11px', borderRadius: '2px' }}>{tag}</Tag>
                              ))}
                            </div>
                          )}
                        </Space>
                      }
                    />
                  </div>
                </List.Item>
              )}
            />
          )}
      </div>
    </div>
  )
}
