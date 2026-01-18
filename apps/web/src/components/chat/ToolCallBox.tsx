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
        style={{
          cursor: collapsible ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {header}
        </div>
        {collapsible && (
          <span className='material-symbols-outlined' style={{ fontSize: 16, color: '#9ca3af' }}>
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        )}
      </div>
      {isExpanded && (
        <div className='tool-call-body' style={type === 'result' ? { backgroundColor: '#f9fafb' } : {}}>
          {content}
        </div>
      )}
    </div>
  )
}
