import './ConfigShortcutInput.scss'

import { Button, Input, Tooltip } from 'antd'
import React from 'react'

import { formatShortcutLabel, getShortcutFromEvent } from '../../utils/shortcutUtils'

export const ShortcutInput = ({
  value,
  onChange,
  placeholder,
  isMac,
  t
}: {
  value: string
  onChange: (nextValue: string) => void
  placeholder: string
  isMac: boolean
  t: (key: string) => string
}) => {
  const label = value.trim() === '' ? '' : formatShortcutLabel(value, isMac)
  return (
    <div className='config-shortcut-input'>
      <Input
        value={label}
        placeholder={placeholder}
        readOnly
        onKeyDown={(event) => {
          if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            onChange('')
            return
          }
          const nextShortcut = getShortcutFromEvent(event)
          if (nextShortcut == null) return
          event.preventDefault()
          onChange(nextShortcut)
        }}
      />
      <Tooltip title={t('config.editor.clearShortcut')}>
        <Button
          size='small'
          type='text'
          className='config-view__icon-button config-view__icon-button--compact'
          aria-label={t('config.editor.clearShortcut')}
          icon={<span className='material-symbols-rounded'>close</span>}
          onClick={() => onChange('')}
        />
      </Tooltip>
    </div>
  )
}
