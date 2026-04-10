import { Tooltip } from 'antd'
import React from 'react'

import { TOOL_TOOLTIP_PROPS } from './tool-display'

export function ToolSummaryHeader({
  icon,
  title,
  target,
  targetTitle,
  meta,
  metaTitle,
  expanded = false,
  collapsible = false,
  targetMonospace = false
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  target?: React.ReactNode
  targetTitle?: string
  meta?: React.ReactNode
  metaTitle?: string
  expanded?: boolean
  collapsible?: boolean
  targetMonospace?: boolean
}) {
  const hasTarget = target != null && target !== ''
  const targetNode = hasTarget
    ? (
      <span className={`tool-summary-header__target ${targetMonospace ? 'tool-summary-header__target--mono' : ''}`}>
        {target}
      </span>
    )
    : null

  return (
    <div className='tool-summary-header'>
      <div className='tool-summary-header__lead'>
        <span className='tool-summary-header__action'>
          {icon != null && (
            <span className='tool-summary-header__icon'>{icon}</span>
          )}
          <span className='tool-summary-header__title'>{title}</span>
        </span>
        {hasTarget && (
          targetTitle != null && targetTitle !== ''
            ? (
              <Tooltip title={targetTitle} {...TOOL_TOOLTIP_PROPS}>
                {targetNode}
              </Tooltip>
            )
            : targetNode
        )}
        {collapsible && (
          <span className={`material-symbols-rounded tool-summary-header__toggle ${expanded ? 'is-expanded' : ''}`}>
            expand_more
          </span>
        )}
      </div>
      {meta != null && (
        <span className='tool-summary-header__meta' title={metaTitle}>
          {meta}
        </span>
      )}
    </div>
  )
}
