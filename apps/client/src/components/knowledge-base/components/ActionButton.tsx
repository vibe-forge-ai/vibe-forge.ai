import './ActionButton.scss'

import { Button } from 'antd'
import type { ButtonProps } from 'antd'

export function ActionButton({ className, children, icon, ...rest }: ButtonProps) {
  const iconOnly = icon != null && (children == null || children === false)
  const mergedClassName = [
    'knowledge-base-view__action-button',
    iconOnly ? 'knowledge-base-view__action-button--icon-only' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <Button {...rest} icon={icon} className={mergedClassName}>
      {children}
    </Button>
  )
}
