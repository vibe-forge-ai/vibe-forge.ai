import './ConfigShortcutInput.scss'

import { Button, Input, Tooltip } from 'antd'
import React from 'react'

import { formatShortcutLabel, getShortcutFromEvent } from '../../utils/shortcutUtils'

export const ShortcutInput = ({
  value,
  displayValue,
  onChange,
  placeholder,
  normalizeShortcut,
  isMac,
  t
}: {
  value: string
  displayValue?: string
  onChange: (nextValue: string) => void
  placeholder: string
  normalizeShortcut?: (nextValue: string) => string | null
  isMac: boolean
  t: (key: string) => string
}) => {
  const effectiveValue = (displayValue ?? value).trim()
  const label = effectiveValue === '' ? '' : formatShortcutLabel(effectiveValue, isMac)
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
          const normalizedShortcut = normalizeShortcut?.(nextShortcut) ?? nextShortcut
          if (normalizedShortcut == null) return
          event.preventDefault()
          onChange(normalizedShortcut)
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
