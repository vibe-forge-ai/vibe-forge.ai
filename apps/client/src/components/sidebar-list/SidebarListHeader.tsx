import './SidebarListHeader.scss'

import { Button, Input, Tooltip } from 'antd'
import type { TooltipProps } from 'antd'
import type { ChangeEventHandler, ReactNode, Ref } from 'react'

interface SidebarListHeaderProps {
  children?: ReactNode
  className?: string
  compact?: boolean
  collapsed?: boolean
  primaryAction: ReactNode
  sideAction?: ReactNode
}

interface SidebarListSearchInputProps {
  allowClear?: boolean
  className?: string
  disabled?: boolean
  placeholder: string
  suffix?: ReactNode
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
}

interface SidebarListCollapsedActionsProps {
  children: ReactNode
  className?: string
}

interface SidebarListCollapsedActionButtonProps {
  active?: boolean
  ariaLabel?: string
  buttonRef?: Ref<HTMLAnchorElement | HTMLButtonElement>
  className?: string
  disabled?: boolean
  filled?: boolean
  icon: string
  tooltip?: ReactNode
  tooltipPlacement?: TooltipProps['placement']
  onClick?: () => void
}

export function SidebarListHeader({
  children,
  className,
  compact = false,
  collapsed = false,
  primaryAction,
  sideAction
}: SidebarListHeaderProps) {
  const rootClassName = [
    'sidebar-list-header',
    compact ? 'sidebar-list-header--compact' : '',
    collapsed ? 'sidebar-list-header--collapsed' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClassName}>
      <div className='sidebar-list-header__top'>
        <div className='sidebar-list-header__primary'>
          {primaryAction}
        </div>
        {sideAction != null && (
          <div className='sidebar-list-header__side'>
            {sideAction}
          </div>
        )}
      </div>
      {!collapsed && children != null && (
        <div className='sidebar-list-header__content'>
          {children}
        </div>
      )}
    </div>
  )
}

export function SidebarListCollapsedActions({
  children,
  className
}: SidebarListCollapsedActionsProps) {
  return (
    <div className={['sidebar-list-collapsed-actions', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export function SidebarListCollapsedActionButton({
  active = false,
  ariaLabel,
  buttonRef,
  className,
  disabled,
  filled = false,
  icon,
  tooltip,
  tooltipPlacement = 'bottom',
  onClick
}: SidebarListCollapsedActionButtonProps) {
  return (
    <Tooltip title={tooltip} placement={tooltipPlacement}>
      <Button
        ref={buttonRef}
        className={[
          'sidebar-list-collapsed-actions__control',
          active ? 'active' : '',
          className
        ].filter(Boolean).join(' ')}
        type='text'
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
      >
        <span className={`material-symbols-rounded ${filled ? 'filled' : ''}`}>
          {icon}
        </span>
      </Button>
    </Tooltip>
  )
}

export function SidebarListSearchInput({
  allowClear = true,
  className,
  disabled,
  placeholder,
  suffix,
  value,
  onChange
}: SidebarListSearchInputProps) {
  return (
    <Input
      className={['sidebar-list-header__search-input', className].filter(Boolean).join(' ')}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      prefix={<span className='material-symbols-rounded sidebar-list-header__search-icon'>search</span>}
      suffix={suffix}
      allowClear={allowClear}
    />
  )
}
