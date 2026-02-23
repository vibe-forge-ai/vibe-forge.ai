import './TaskToolCard.scss'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ChatMessage, WSEvent } from '@vibe-forge/core'

import { connectionManager } from '#~/connectionManager.js'
import { CodeBlock } from '../../../CodeBlock'

export interface TaskToolCardProps {
  description?: string
  status?: 'running' | 'completed' | 'failed'
  logs?: string[] | null
  adapter?: string | null
  type?: 'default' | 'spec' | 'entity'
  name?: string | null
  background?: boolean
  sessionId?: string | null
  titleFallback?: string
  metaChips?: Array<string | null | undefined>
  showExecutionIcon?: boolean
  foregroundLabel?: string
  backgroundLabel?: string
}

function parseTaskDescription(description?: string): { title: string; content: string } {
  if (!description) {
    return { title: '', content: '' }
  }
  const lines = description.split('\n')
  const title = lines[0] || ''
  const content = lines.slice(1).join('\n').trim()
  return { title, content }
}

function getStatusIcon(status?: string): string {
  switch (status) {
    case 'running':
      return 'play_circle'
    case 'completed':
      return 'check_circle'
    case 'failed':
      return 'error'
    default:
      return 'help_outline'
  }
}

export function TaskToolCard({
  description,
  status,
  logs,
  background,
  sessionId,
  titleFallback,
  metaChips,
  showExecutionIcon,
  foregroundLabel,
  backgroundLabel
}: TaskToolCardProps) {
  const navigate = useNavigate()
  const [liveLogs, setLiveLogs] = useState<string[]>(logs ?? [])
  const [liveStatus, setLiveStatus] = useState(status)
  const seenMessageIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setLiveLogs(logs ?? [])
  }, [logs])

  useEffect(() => {
    setLiveStatus(status)
  }, [status])

  const { title, content } = parseTaskDescription(description)
  const logText = useMemo(() => (liveLogs?.join('\n') ?? '').trim(), [liveLogs])
  const resolvedTitle = title || titleFallback || ''
  const chips = (metaChips ?? []).filter((item): item is string => Boolean(item))
  const isForeground = background === false
  const executionClass = isForeground
    ? 'task-tool-card__execution-icon--foreground'
    : 'task-tool-card__execution-icon--background'
  const executionLabel = isForeground ? foregroundLabel : backgroundLabel
  const displaySessionId = sessionId != null && sessionId !== ''

  useEffect(() => {
    if (!sessionId) return
    const cleanup = connectionManager.connect(sessionId, {
      onMessage(data: WSEvent) {
        if (data.type === 'message') {
          const message = data.message as ChatMessage
          if (message.id && seenMessageIdsRef.current.has(message.id)) {
            return
          }
          if (message.id) {
            seenMessageIdsRef.current.add(message.id)
          }
          const text = extractMessageText(message)
          if (text !== '') {
            setLiveLogs((prev) => [...prev, text])
          }
        } else if (data.type === 'session_updated') {
          if (data.session?.id === sessionId) {
            const updatedStatus = data.session?.status as typeof status | undefined
            if (updatedStatus) {
              setLiveStatus(updatedStatus)
            }
          }
        }
      }
    })
    return () => {
      cleanup?.()
    }
  }, [sessionId])

  return (
    <div className='task-tool-card'>
      <div className='task-tool-card__left'>
        <span className={`material-symbols-rounded task-tool-card__status-icon ${liveStatus ?? 'help_outline'}`}>
          {getStatusIcon(liveStatus)}
        </span>
        {showExecutionIcon && (
          <span
            className={`material-symbols-rounded task-tool-card__execution-icon ${executionClass}`}
            title={executionLabel}
          >
            {isForeground ? 'desktop_windows' : 'schedule'}
          </span>
        )}
      </div>
      <div className='task-tool-card__main'>
        <div className='task-tool-card__header'>
          <div className='task-tool-card__title'>{resolvedTitle}</div>
          {displaySessionId && (
            <button
              type='button'
              className='task-tool-card__session-id task-tool-card__session-link'
              onClick={() => navigate(`/session/${sessionId}`)}
            >
              {sessionId}
            </button>
          )}
        </div>
        {content && (
          <div className='task-tool-card__content'>
            {content}
          </div>
        )}
        {chips.length > 0 && (
          <div className='task-tool-card__meta'>
            {chips.map((item) => (
              <span className='task-tool-card__meta-chip' key={item}>{item}</span>
            ))}
          </div>
        )}
        <CodeBlock
          hideHeader
          code={logText}
          lang='md'
        />
      </div>
    </div>
  )
}

function extractMessageText(message: ChatMessage): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
  }
  return ''
}
