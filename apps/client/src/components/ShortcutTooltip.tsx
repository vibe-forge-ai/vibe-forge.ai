import { Tooltip } from 'antd'
import type { TooltipPlacement } from 'antd/es/tooltip'
import React, { useMemo } from 'react'

import { formatShortcutLabel } from '#~/utils/shortcutUtils'

export function ShortcutTooltip({
  shortcut,
  isMac,
  title,
  children,
  placement = 'top',
  enabled = true,
  targetClassName
}: {
  shortcut?: string
  isMac: boolean
  title: React.ReactNode | ((shortcutLabel: string) => React.ReactNode)
  children: React.ReactNode
  placement?: TooltipPlacement
  enabled?: boolean
  targetClassName?: string
}) {
  const shortcutLabel = useMemo(() => formatShortcutLabel(shortcut, isMac), [isMac, shortcut])
  const resolvedTitle = useMemo(() => {
    if (!enabled || shortcutLabel === '') {
      return null
    }

    return typeof title === 'function' ? title(shortcutLabel) : title
  }, [enabled, shortcutLabel, title])

  if (resolvedTitle == null) {
    return <>{children}</>
  }

  return (
    <Tooltip title={resolvedTitle} placement={placement}>
      <span className={targetClassName}>{children}</span>
    </Tooltip>
  )
}
