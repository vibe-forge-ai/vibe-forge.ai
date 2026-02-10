import './TaskToolCard.scss'

import React from 'react'

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
  const { title, content } = parseTaskDescription(description)
  const logText = (logs?.join('\n') ?? '').trim()
  const resolvedTitle = title || titleFallback || ''
  const chips = (metaChips ?? []).filter((item): item is string => Boolean(item))
  const isForeground = background === false
  const executionClass = isForeground
    ? 'task-tool-card__execution-icon--foreground'
    : 'task-tool-card__execution-icon--background'
  const executionLabel = isForeground ? foregroundLabel : backgroundLabel
  const displaySessionId = sessionId != null && sessionId !== ''

  return (
    <div className='task-tool-card'>
      <div className='task-tool-card__left'>
        <span className={`material-symbols-rounded task-tool-card__status-icon ${status ?? 'help_outline'}`}>
          {getStatusIcon(status)}
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
            <span className='task-tool-card__session-id'>{sessionId}</span>
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
