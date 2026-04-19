import './RecordJsonEditor.scss'

import { Button, Input, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ComplexTextEditor } from '../ConfigEditors'
import type { TranslationFn } from '../configUtils'

export const RecordJsonEditor = ({
  value,
  onChange,
  highlightedKey,
  t,
  keyPlaceholder
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  highlightedKey?: string
  t: TranslationFn
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = useMemo(() => Object.entries(value), [value])
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
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

  useEffect(() => {
    if (highlightedKey == null || highlightedKey.trim() === '' || !Object.hasOwn(value, highlightedKey)) {
      return
    }

    setCollapsedKeys(prev => prev[highlightedKey] === false ? prev : { ...prev, [highlightedKey]: false })
    const frame = window.requestAnimationFrame(() => {
      cardRefs.current[highlightedKey]?.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [highlightedKey, value])

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const isCollapsed = collapsedKeys[key] === true
        return (
          <div
            key={key}
            ref={(node) => {
              cardRefs.current[key] = node
            }}
            className={[
              'config-view__record-card',
              isCollapsed ? 'config-view__record-card--collapsed' : '',
              highlightedKey === key ? 'config-view__record-card--highlighted' : ''
            ].filter(Boolean).join(' ')}
          >
            <div className='config-view__record-title'>
              <div className='config-view__record-title-left'>
                <Tooltip title={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}>
                  <Button
                    size='small'
                    type='text'
                    className='config-view__icon-button config-view__icon-button--compact'
                    aria-label={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}
                    icon={
                      <span className='material-symbols-rounded'>{isCollapsed ? 'chevron_right' : 'expand_more'}</span>
                    }
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
          <Tooltip title={t('common.confirm')}>
            <Button
              size='small'
              type='primary'
              className='config-view__icon-button'
              aria-label={t('common.confirm')}
              icon={<span className='material-symbols-rounded'>check</span>}
              disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
              onClick={() => {
                onChange({ ...value, [newKey]: {} })
                setNewKey('')
              }}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
