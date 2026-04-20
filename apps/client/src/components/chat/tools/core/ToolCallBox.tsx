import './ToolCallBox.scss'
import React, { useState } from 'react'

type ToolCallBoxHeaderRender = (state: {
  isExpanded: boolean
  isCollapsible: boolean
}) => React.ReactNode

export function ToolCallBox({
  header,
  content,
  isError = false,
  type = 'call',
  defaultExpanded = false,
  collapsible = true,
  variant = 'default',
  onDoubleClick
}: {
  header: React.ReactNode | ToolCallBoxHeaderRender
  content?: React.ReactNode
  isError?: boolean
  type?: 'call' | 'result'
  defaultExpanded?: boolean
  collapsible?: boolean
  variant?: 'default' | 'inline'
  onDoubleClick?: (e: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || !collapsible)
  const hasBody = content != null && content !== false
  const isCollapsible = collapsible && hasBody

  const isExpanded = hasBody && (!isCollapsible || expanded)
  const shouldRenderBodyContent = hasBody && (isExpanded || !isCollapsible)
  const headerContent = typeof header === 'function'
    ? header({ isExpanded, isCollapsible })
    : header

  return (
    <div
      className={`tool-call-box tool-call-box--${variant} ${type === 'result' ? 'result' : ''} ${
        isExpanded ? 'expanded' : 'collapsed'
      }`}
      onDoubleClick={(e) => {
        if (onDoubleClick) {
          e.stopPropagation()
          onDoubleClick(e)
        }
      }}
    >
      <div
        className={`tool-call-header ${type === 'result' && isError ? 'error' : ''} ${
          isCollapsible ? 'is-collapsible' : 'is-static'
        }`}
        aria-expanded={isCollapsible ? isExpanded : undefined}
        onClick={() => isCollapsible && setExpanded(!expanded)}
      >
        <div className='tool-call-header-main'>
          {headerContent}
        </div>
        {isCollapsible && typeof header !== 'function' && (
          <span className={`material-symbols-rounded expand-icon ${isExpanded ? 'is-expanded' : ''}`}>
            expand_more
          </span>
        )}
      </div>
      {hasBody && (
        <div
          className={`tool-call-body-shell ${isExpanded ? 'expanded' : 'collapsed'}`}
          aria-hidden={!isExpanded}
        >
          <div className='tool-call-body'>
            {shouldRenderBodyContent ? content : null}
          </div>
        </div>
      )}
    </div>
  )
}
