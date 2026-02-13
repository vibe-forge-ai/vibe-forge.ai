import './RecordJsonEditor.scss'

import { Button, Input, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { ComplexTextEditor } from '../ConfigEditors'
import type { TranslationFn } from '../configUtils'

export const RecordJsonEditor = ({
  value,
  onChange,
  t,
  addLabel,
  keyPlaceholder
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
  addLabel: string
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = useMemo(() => Object.entries(value), [value])
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(entries.map(([key]) => [key, true]))
  ))

  useEffect(() => {
    setCollapsedKeys(prev => {
      const next: Record<string, boolean> = {}
      for (const [key] of entries) {
        next[key] = prev[key] ?? true
      }
      return next
    })
  }, [entries])

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const isCollapsed = collapsedKeys[key] === true
        return (
          <div
            key={key}
            className={`config-view__record-card${isCollapsed ? ' config-view__record-card--collapsed' : ''}`}
          >
          <div className='config-view__record-title'>
            <div className='config-view__record-title-left'>
              <Tooltip title={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}>
                <Button
                  size='small'
                  type='text'
                  className='config-view__icon-button config-view__icon-button--compact'
                  aria-label={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}
                  icon={<span className='material-symbols-rounded'>{isCollapsed ? 'chevron_right' : 'expand_more'}</span>}
                  onClick={() => {
                    setCollapsedKeys(prev => ({ ...prev, [key]: !isCollapsed }))
                  }}
                />
              </Tooltip>
              <span>{key}</span>
            </div>
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
          <div className='config-view__record-body'>
            <ComplexTextEditor
              value={itemValue}
              onChange={(next) => {
                onChange({ ...value, [key]: next })
              }}
            />
          </div>
        </div>
        )
      })}
      <div className='config-view__record-add'>
        <div className='config-view__record-add-inputs'>
          <Input
            value={newKey}
            placeholder={keyPlaceholder}
            onChange={(event) => setNewKey(event.target.value)}
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
              onChange({ ...value, [newKey]: {} })
              setNewKey('')
            }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
