import './TaskRow.scss'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ChatMessage, WSEvent } from '@vibe-forge/core'

import { connectionManager } from '#~/connectionManager.js'
import { MarkdownContent } from '#~/components/chat/MarkdownContent'

export interface TaskRowProps {
  description?: string
  status?: 'running' | 'completed' | 'failed'
  logs?: string[] | null
  sessionId?: string | null
  titleFallback?: string
  metaChips?: Array<string | null | undefined>
  showExecutionIcon?: boolean
  background?: boolean
  foregroundLabel?: string
  backgroundLabel?: string
}

function parseTaskDescription(description?: string): { title: string } {
  if (!description) {
    return { title: '' }
  }
  const lines = description.split('\n')
  const title = lines[0] || ''
  return { title }
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

export function TaskRow({
  description,
  status,
  logs,
  sessionId,
  titleFallback,
  metaChips,
  showExecutionIcon,
  background,
  foregroundLabel,
  backgroundLabel
}: TaskRowProps) {
  const navigate = useNavigate()
  const [liveLogs, setLiveLogs] = useState<string[]>(logs ?? [])
  const [liveStatus, setLiveStatus] = useState(status)
  const seenMessageIdsRef = useRef<Set<string>>(new Set())
  const { title } = parseTaskDescription(description)
  const resolvedTitle = title || titleFallback || ''
  const chips = (metaChips ?? []).filter((item): item is string => Boolean(item))
  const isForeground = background === false
  const executionClass = isForeground
    ? 'task-row__execution-icon--foreground'
    : 'task-row__execution-icon--background'
  const executionLabel = isForeground ? foregroundLabel : backgroundLabel
  const displaySessionId = sessionId != null && sessionId !== ''
  const logText = useMemo(() => (liveLogs?.join('\n') ?? '').trim(), [liveLogs])

  useEffect(() => {
    setLiveLogs(logs ?? [])
  }, [logs])

  useEffect(() => {
    setLiveStatus(status)
  }, [status])

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
        } else if (data.type === 'session_updated' && data.session?.id === sessionId) {
          const updatedStatus = data.session?.status as typeof status | undefined
          if (updatedStatus) {
            setLiveStatus(updatedStatus)
          }
        }
      }
    })
    return () => {
      cleanup?.()
    }
  }, [sessionId])

  return (
    <div className='task-row'>
      <div className='task-row__header'>
        <div className='task-row__left'>
          <span className={`material-symbols-rounded task-row__status-icon ${liveStatus ?? 'help_outline'}`}>
            {getStatusIcon(liveStatus)}
          </span>
          {showExecutionIcon && (
            <span
              className={`material-symbols-rounded task-row__execution-icon ${executionClass}`}
              title={executionLabel}
            >
              {isForeground ? 'desktop_windows' : 'schedule'}
            </span>
          )}
        </div>
        <span className='task-row__title'>{resolvedTitle}</span>
        {displaySessionId && (
          <button
            type='button'
            className='task-row__session-link'
            onClick={() => navigate(`/session/${sessionId}`)}
          >
            {sessionId}
          </button>
        )}
        {chips.length > 0 && (
          <div className='task-row__meta'>
            {chips.map((item) => (
              <span className='task-row__meta-chip' key={item}>{item}</span>
            ))}
          </div>
        )}
      </div>
      {logText !== '' && (
        <div className='task-row__logs'>
          <MarkdownContent content={logText} />
        </div>
      )}
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
