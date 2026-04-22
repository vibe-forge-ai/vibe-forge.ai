import './RecordJsonEditor.scss'

import { Button, Input, Select, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import type { ConfigUiRecordMapSchema } from '@vibe-forge/types'

import { ComplexTextEditor } from '../ConfigEditors'
import { getValueByPath, setValueByPath } from '../configUtils'
import type { TranslationFn } from '../configUtils'

import { SchemaObjectEditor } from './SchemaObjectEditor'
import { buildConfigUiObjectDefaultValue, resolveConfigUiRecordEntry } from './schemaRecordUtils'

export const SchemaRecordEditor = ({
  value,
  schema,
  onChange,
  t,
  keyPlaceholder
}: {
  value: Record<string, unknown>
  schema: ConfigUiRecordMapSchema
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const [newKind, setNewKind] = useState(schema.entryKinds?.[0]?.key ?? '')
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
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as Record<string, unknown>
          : {}
        const { itemSchema, isKnownEntry } = resolveConfigUiRecordEntry({
          schema,
          entryKey: key,
          entryValue: recordValue
        })
        const isCollapsed = collapsedKeys[key] === true
        const discriminatorField = schema.discriminatorField ?? 'type'
        const discriminatorValue = schema.mode === 'discriminated'
          ? getValueByPath(recordValue, [discriminatorField])
          : undefined
        const shouldRenderJsonFallback = !isKnownEntry && schema.unknownEditor === 'json'
        const kindMeta = typeof discriminatorValue === 'string'
          ? schema.entryKinds?.find(item => item.key === discriminatorValue)
          : schema.entryKinds?.find(item => item.key === key)

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
                    icon={
                      <span className='material-symbols-rounded'>{isCollapsed ? 'chevron_right' : 'expand_more'}</span>
                    }
                    onClick={() => {
                      setCollapsedKeys(prev => ({ ...prev, [key]: !isCollapsed }))
                    }}
                  />
                </Tooltip>
                <div className='config-view__record-heading'>
                  <div>{key}</div>
                  {kindMeta?.label != null && kindMeta.label !== key && (
                    <div className='config-view__record-subtitle'>{kindMeta.label}</div>
                  )}
                  {kindMeta?.description != null && kindMeta.description !== '' && (
                    <div className='config-view__record-desc'>{kindMeta.description}</div>
                  )}
                </div>
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
              {!shouldRenderJsonFallback && itemSchema != null && (
                <SchemaObjectEditor
                  value={recordValue}
                  schema={itemSchema}
                  onChange={(updated) => {
                    onChange({ ...value, [key]: updated })
                  }}
                  t={t}
                  hideFieldPaths={isKnownEntry && schema.mode === 'discriminated' ? [[discriminatorField]] : undefined}
                />
              )}
              {shouldRenderJsonFallback && (
                <ComplexTextEditor
                  value={recordValue}
                  onChange={(updated) => {
                    onChange({ ...value, [key]: updated })
                  }}
                />
              )}
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
          {schema.mode === 'discriminated' && (
            <Select
              value={newKind}
              options={(schema.entryKinds ?? []).map(item => ({
                value: item.key,
                label: item.label ?? item.key
              }))}
              onChange={(nextValue) => setNewKind(nextValue)}
            />
          )}
          <Tooltip title={t('common.confirm')}>
            <Button
              size='small'
              type='primary'
              className='config-view__icon-button'
              aria-label={t('common.confirm')}
              icon={<span className='material-symbols-rounded'>check</span>}
              disabled={newKey.trim() === '' ||
                Object.hasOwn(value, newKey) ||
                (schema.mode === 'discriminated' && newKind.trim() === '')}
              onClick={() => {
                const nextSchema = schema.mode === 'discriminated'
                  ? (schema.schemas[newKind] ?? schema.unknownSchema)
                  : (schema.schemas[newKey] ?? schema.unknownSchema)
                const nextEntry = buildConfigUiObjectDefaultValue(nextSchema)

                if (schema.mode === 'discriminated') {
                  const discriminatorField = schema.discriminatorField ?? 'type'
                  Object.assign(nextEntry, setValueByPath(nextEntry, [discriminatorField], newKind))
                }

                onChange({ ...value, [newKey]: nextEntry })
                setNewKey('')
              }}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
