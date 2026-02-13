import './BooleanRecordEditor.scss'

import { Button, Input, Switch, Tooltip } from 'antd'
import { useState } from 'react'

import type { TranslationFn } from '../configUtils'

export const BooleanRecordEditor = ({
  value,
  onChange,
  t,
  keyPlaceholder
}: {
  value: Record<string, boolean>
  onChange: (nextValue: Record<string, boolean>) => void
  t: TranslationFn
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => (
        <div key={key} className='config-view__record-row'>
          <div className='config-view__record-key'>{key}</div>
          <Switch
            checked={Boolean(itemValue)}
            onChange={(next) => {
              onChange({ ...value, [key]: next })
            }}
          />
          <Tooltip title={t('config.editor.remove')}>
            <Button
              size='small'
              type='text'
              danger
              className='config-view__icon-button config-view__icon-button--compact'
              aria-label={t('config.editor.remove')}
              icon={<span className='material-symbols-rounded'>delete</span>}
              onClick={() => {
                const updated = { ...value }
                delete updated[key]
                onChange(updated)
              }}
            />
          </Tooltip>
        </div>
      ))}
      <div className='config-view__record-add'>
        <div className='config-view__record-add-inputs'>
          <Input
            value={newKey}
            placeholder={keyPlaceholder}
            onChange={(event) => setNewKey(event.target.value)}
          />
        </div>
        <Tooltip title={t('config.editor.addField')}>
          <Button
            size='small'
            type='primary'
            className='config-view__icon-button config-view__icon-button--full'
            aria-label={t('config.editor.addField')}
            icon={<span className='material-symbols-rounded'>add</span>}
            disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
            onClick={() => {
              onChange({ ...value, [newKey]: true })
              setNewKey('')
            }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
