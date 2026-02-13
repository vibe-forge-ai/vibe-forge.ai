import './KeyValueEditor.scss'

import { Button, Input, Tooltip } from 'antd'
import { useState } from 'react'

import { isSensitiveKey } from '../configUtils'
import type { TranslationFn } from '../configUtils'

export const KeyValueEditor = ({
  value,
  onChange,
  t,
  addLabel,
  keyPlaceholder
}: {
  value: Record<string, string>
  onChange: (nextValue: Record<string, string>) => void
  t: TranslationFn
  addLabel: string
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__array-list'>
      {entries.map(([key, val]) => (
        <div key={key} className='config-view__array-item'>
          <div className='config-view__record-key'>{key}</div>
          {isSensitiveKey(key)
            ? (
              <Input.Password
                value={val}
                onChange={(event) => {
                  onChange({ ...value, [key]: event.target.value })
                }}
                placeholder={t('config.editor.fieldValue')}
              />
            )
            : (
              <Input
                value={val}
                onChange={(event) => {
                  onChange({ ...value, [key]: event.target.value })
                }}
                placeholder={t('config.editor.fieldValue')}
              />
            )}
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
      <div className='config-view__array-add'>
        <div className='config-view__array-add-inputs'>
          <Input
            value={newKey}
            placeholder={keyPlaceholder}
            onChange={(event) => setNewKey(event.target.value)}
          />
          <Input
            value={newValue}
            placeholder={t('config.editor.fieldValue')}
            onChange={(event) => setNewValue(event.target.value)}
          />
        </div>
        <Tooltip title={addLabel}>
          <Button
            size='small'
            type='primary'
            className='config-view__icon-button config-view__icon-button--full'
            aria-label={addLabel}
            icon={<span className='material-symbols-rounded'>add</span>}
            disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
            onClick={() => {
              const nextValue = { ...value, [newKey]: newValue }
              onChange(nextValue)
              setNewKey('')
              setNewValue('')
            }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
