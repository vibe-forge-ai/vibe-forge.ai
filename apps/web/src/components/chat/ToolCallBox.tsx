import './ToolCallBox.scss'
import React, { useState } from 'react'

export function ToolCallBox({
  header,
  content,
  isError = false,
  type = 'call',
  defaultExpanded = false,
  collapsible = true,
  onDoubleClick
}: {
  header: React.ReactNode
  content: React.ReactNode
  isError?: boolean
  type?: 'call' | 'result'
  defaultExpanded?: boolean
  collapsible?: boolean
  onDoubleClick?: (e: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || !collapsible)

  const isExpanded = !collapsible || expanded

  return (
    <div
      className={`tool-call-box ${type === 'result' ? 'result' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          e.stopPropagation()
          onDoubleClick(e)
        }
      }}
    >
      <div
        className={`tool-call-header ${type === 'result' && isError ? 'error' : ''}`}
        onClick={() => collapsible && setExpanded(!expanded)}
      >
        <div className='tool-call-header-main'>
          {header}
        </div>
        {collapsible && (
          <span className='material-symbols-rounded expand-icon'>
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        )}
      </div>
      {isExpanded && (
        <div className='tool-call-body'>
          {content}
        </div>
      )}
    </div>
  )
}
