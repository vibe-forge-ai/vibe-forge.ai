import './ActionButton.scss'

import { Button } from 'antd'
import type { ButtonProps } from 'antd'

export function ActionButton({ className, ...rest }: ButtonProps) {
  const mergedClassName = ['knowledge-base-view__action-button', className].filter(Boolean).join(' ')
  return <Button {...rest} className={mergedClassName} />
}
