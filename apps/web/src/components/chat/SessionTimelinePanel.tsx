import './SessionTimelinePanel.scss'

import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import { Empty } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface TimelineEntry {
  id: string
  name: string
  createdAt?: number
  hasResult: boolean
  index: number
}

function formatTime(value?: number) {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

function getToolResults(messages: ChatMessage[]) {
  const result = new Map<string, Extract<ChatMessageContent, { type: 'tool_result' }>>()
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue
    for (const item of message.content) {
      if (item.type === 'tool_result') {
        result.set(item.tool_use_id, item as Extract<ChatMessageContent, { type: 'tool_result' }>)
      }
    }
  }
  return result
}

function getTimelineEntries(messages: ChatMessage[]) {
  const resultsMap = getToolResults(messages)
  const entries: TimelineEntry[] = []
  let index = 0
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue
    for (const item of message.content) {
      if (item.type === 'tool_use') {
        const resultItem = resultsMap.get(item.id)
        entries.push({
          id: item.id,
          name: item.name,
          createdAt: message.createdAt,
          hasResult: resultItem != null,
          index
        })
        index += 1
      }
    }
  }
  return entries
}

export function SessionTimelinePanel({
  messages,
  isThinking
}: {
  messages: ChatMessage[]
  isThinking: boolean
}) {
  const { t } = useTranslation()
  const entries = React.useMemo(() => getTimelineEntries(messages), [messages])

  const times = entries.map(entry => entry.createdAt ?? 0).filter(value => value > 0)
  const minTime = times.length > 0 ? Math.min(...times) : 0
  const maxTime = times.length > 0 ? Math.max(...times) : 0
  const range = maxTime - minTime || 1

  if (entries.length === 0) {
    return (
      <div className='session-timeline-panel is-empty'>
        <Empty description={t('chat.timelineEmpty')} />
      </div>
    )
  }

  return (
    <div className='session-timeline-panel'>
      <div className='session-timeline-header'>
        <div>{t('chat.timelineTask')}</div>
        <div>{t('chat.timelineStatus')}</div>
        <div>{t('chat.timelineTiming')}</div>
        <div>{t('chat.timelineStart')}</div>
      </div>
      <div className='session-timeline-body'>
        {entries.map((entry) => {
          const startPercent = entry.createdAt ? ((entry.createdAt - minTime) / range) * 100 : 0
          const widthPercent = Math.min(28, Math.max(10, 100 - startPercent))
          return (
            <div key={entry.id} className='session-timeline-row'>
              <div className='session-timeline-name'>
                <span className={`session-timeline-dot ${entry.hasResult ? 'is-done' : 'is-running'}`} />
                <span className='session-timeline-title'>{entry.name || t('chat.timelineTask')}</span>
                <span className='session-timeline-index'>#{entry.index + 1}</span>
              </div>
              <div className={`session-timeline-status ${entry.hasResult ? 'is-done' : 'is-running'}`}>
                {entry.hasResult ? t('common.status.completed') : isThinking ? t('common.status.running') : t('common.status.waiting_input')}
              </div>
              <div className='session-timeline-bar'>
                <span className='session-timeline-bar-track' />
                <span
                  className={`session-timeline-bar-fill ${entry.hasResult ? 'is-done' : 'is-running'}`}
                  style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                />
              </div>
              <div className='session-timeline-time'>{formatTime(entry.createdAt)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
