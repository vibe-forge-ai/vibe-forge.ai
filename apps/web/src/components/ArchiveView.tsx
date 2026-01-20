import type { Session } from '@vibe-forge/core'
import { Button, Empty, List, Popconfirm, Space, Tag } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { deleteSession, listSessions, updateSession } from '../api'

export function ArchiveView() {
  const { t } = useTranslation()
  const { data: sessionsRes, mutate } = useSWR('/api/sessions/archived', async () => listSessions('archived'))
  const sessions = sessionsRes?.sessions ?? []

  const handleRestore = async (id: string) => {
    await updateSession(id, { isArchived: false })
    void mutate()
  }

  const handleDelete = async (id: string) => {
    await deleteSession(id)
    void mutate()
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <h2>{t('common.archive')}</h2>
      {sessions.length === 0
        ? (
          <Empty description={t('common.noArchivedSessions', 'No archived sessions')} />
        )
        : (
          <List
            itemLayout='horizontal'
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                actions={[
                  <Button key='restore' type='link' onClick={() => void handleRestore(session.id)}>
                    {t('common.restore', 'Restore')}
                  </Button>,
                  <Popconfirm
                    key='delete'
                    title={t('common.deleteSessionConfirm')}
                    onConfirm={() => void handleDelete(session.id)}
                  >
                    <Button type='link' danger>
                      {t('common.delete')}
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={session.title}
                  description={
                    <Space direction='vertical' size={4}>
                      <div>{new Date(session.createdAt).toLocaleString()}</div>
                      <div>
                        {session.tags?.map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
    </div>
  )
}
