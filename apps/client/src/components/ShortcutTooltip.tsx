import './ShortcutTooltip.scss'

import { Tooltip } from 'antd'
import type { TooltipPlacement } from 'antd/es/tooltip'
import React, { forwardRef, useMemo } from 'react'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { formatShortcutLabel } from '#~/utils/shortcutUtils'
import { ShortcutDisplay } from './ShortcutDisplay'

type ShortcutTooltipTitle = React.ReactNode | ((shortcutLabel: string) => React.ReactNode)

type ShortcutTooltipProps = {
  shortcut?: string
  isMac: boolean
  title: ShortcutTooltipTitle
  children: React.ReactNode
  placement?: TooltipPlacement
  enabled?: boolean
  targetClassName?: string
} & React.ComponentPropsWithoutRef<'div'>

const resolveShortcutTooltipTitle = (title: ShortcutTooltipTitle, shortcutLabel: string) => {
  if (typeof title === 'function') {
    return title(shortcutLabel)
  }

  return title
}

export const ShortcutTooltip = forwardRef<HTMLDivElement, ShortcutTooltipProps>(({
  shortcut,
  isMac,
  title,
  children,
  placement = 'top',
  enabled = true,
  targetClassName,
  className,
  ...divProps
}, ref) => {
  const { isTouchInteraction } = useResponsiveLayout()
  const shortcutLabel = useMemo(() => formatShortcutLabel(shortcut, isMac), [isMac, shortcut])
  const resolvedTitle = useMemo(() => {
    if (!enabled || isTouchInteraction || shortcutLabel === '') {
      return null
    }

    return resolveShortcutTooltipTitle(title, shortcutLabel)
  }, [enabled, isTouchInteraction, shortcutLabel, title])

  const trigger = (
    <div
      {...divProps}
      ref={ref}
      className={['shortcut-tooltip-target', targetClassName, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )

  if (resolvedTitle == null) {
    return trigger
  }

  return (
    <Tooltip
      title={
        <span className='shortcut-tooltip-content'>
          <span className='shortcut-tooltip-content__label'>{resolvedTitle}</span>
          <ShortcutDisplay shortcut={shortcut} isMac={isMac} />
        </span>
      }
      placement={placement}
      classNames={{ root: 'shortcut-tooltip-popover' }}
      trigger={['hover']}
      mouseEnterDelay={.3}
      mouseLeaveDelay={.08}
      arrow={false}
    >
      {trigger}
    </Tooltip>
  )
})

ShortcutTooltip.displayName = 'ShortcutTooltip'
