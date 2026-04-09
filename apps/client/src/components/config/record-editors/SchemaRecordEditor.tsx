/* eslint-disable max-lines -- schema-driven editor keeps record rendering in one place for now */
import './RecordJsonEditor.scss'

import { Button, Input, InputNumber, Select, Switch, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import type { ConfigUiField, ConfigUiRecordMapSchema } from '@vibe-forge/types'

import { ComplexTextEditor, StringArrayEditor } from '../ConfigEditors'
import { FieldRow } from '../ConfigFieldRow'
import { getTypeIcon, getValueByPath, isSensitiveKey, setValueByPath } from '../configUtils'
import type { TranslationFn } from '../configUtils'

const toLabel = (value: string) => (
  value
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase())
)

const buildDefaultValue = (schema: ConfigUiRecordMapSchema['schemas'][string] | undefined) => {
  const initial: Record<string, unknown> = {}
  for (const field of schema?.fields ?? []) {
    if (field.defaultValue !== undefined) {
      const nextValue = typeof field.defaultValue === 'object' && field.defaultValue != null
        ? JSON.parse(JSON.stringify(field.defaultValue))
        : field.defaultValue
      Object.assign(initial, setValueByPath(initial, field.path, nextValue))
    }
  }
  return initial
}

const buildSelectOptions = (field: ConfigUiField) => (
  (field.options ?? []).map(option => ({
    value: option.value,
    label: option.label ?? option.value
  }))
)

const resolveFieldIcon = (field: ConfigUiField) => {
  if (field.icon != null) return field.icon
  if (field.type === 'json') return getTypeIcon('object')
  if (field.type === 'string[]') return getTypeIcon('array')
  if (field.type === 'select' || field.type === 'multiline') return getTypeIcon('string')
  if (field.type === 'string' || field.type === 'number' || field.type === 'boolean') {
    return getTypeIcon(field.type)
  }
  return getTypeIcon('object')
}

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

  const resolveEntrySchema = (entryKey: string, entryValue: Record<string, unknown>) => {
    if (schema.mode === 'keyed') {
      return schema.schemas[entryKey] ?? schema.unknownSchema
    }

    const discriminatorField = schema.discriminatorField ?? 'type'
    const discriminatorValue = getValueByPath(entryValue, [discriminatorField])
    if (typeof discriminatorValue === 'string') {
      return schema.schemas[discriminatorValue] ?? schema.unknownSchema
    }
    return schema.unknownSchema
  }

  const renderField = (
    recordKey: string,
    recordValue: Record<string, unknown>,
    field: ConfigUiField
  ) => {
    const discriminatorField = schema.mode === 'discriminated' ? (schema.discriminatorField ?? 'type') : undefined
    if (discriminatorField != null && field.path.length === 1 && field.path[0] === discriminatorField) {
      return null
    }

    const currentValue = getValueByPath(recordValue, field.path)
    const valueToUse = currentValue !== undefined ? currentValue : field.defaultValue
    const title = field.label ?? toLabel(field.path[field.path.length - 1] ?? '')
    const description = field.description ?? ''
    const nextValue = (updated: unknown) => {
      onChange({
        ...value,
        [recordKey]: setValueByPath(recordValue, field.path, updated)
      })
    }

    let control: ReactNode = null
    const stacked = field.type === 'json' || field.type === 'multiline' || field.type === 'string[]'

    if (field.type === 'string') {
      const sensitive = field.sensitive === true || isSensitiveKey(field.path[field.path.length - 1] ?? '')
      control = sensitive
        ? (
          <Input.Password
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => nextValue(event.target.value)}
            placeholder={field.placeholder ?? t('config.editor.secretPlaceholder')}
          />
        )
        : (
          <Input
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => nextValue(event.target.value)}
            placeholder={field.placeholder}
          />
        )
    } else if (field.type === 'multiline') {
      control = (
        <Input.TextArea
          value={typeof valueToUse === 'string' ? valueToUse : ''}
          onChange={(event) => nextValue(event.target.value)}
          autoSize={{ minRows: 2 }}
          placeholder={field.placeholder}
        />
      )
    } else if (field.type === 'number') {
      control = (
        <InputNumber
          value={typeof valueToUse === 'number' ? valueToUse : undefined}
          onChange={(input) => nextValue(typeof input === 'number' ? input : undefined)}
        />
      )
    } else if (field.type === 'boolean') {
      control = (
        <Switch
          checked={Boolean(valueToUse)}
          onChange={(checked) => nextValue(checked)}
        />
      )
    } else if (field.type === 'string[]') {
      control = (
        <StringArrayEditor
          value={Array.isArray(valueToUse) ? valueToUse.filter(item => typeof item === 'string') : []}
          onChange={(items) => nextValue(items)}
          t={t}
        />
      )
    } else if (field.type === 'select') {
      control = (
        <Select
          value={typeof valueToUse === 'string' ? valueToUse : undefined}
          options={buildSelectOptions(field)}
          onChange={(selected) => nextValue(selected)}
        />
      )
    } else {
      control = (
        <ComplexTextEditor
          value={valueToUse ?? {}}
          onChange={(updated) => nextValue(updated)}
        />
      )
    }

    return (
      <FieldRow
        key={`${recordKey}:${field.path.join('.')}`}
        title={title}
        description={description}
        icon={resolveFieldIcon(field)}
        layout={stacked ? 'stacked' : 'inline'}
      >
        {control}
      </FieldRow>
    )
  }

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as Record<string, unknown>
          : {}
        const itemSchema = resolveEntrySchema(key, recordValue)
        const isCollapsed = collapsedKeys[key] === true
        const discriminatorField = schema.discriminatorField ?? 'type'
        const discriminatorValue = schema.mode === 'discriminated'
          ? getValueByPath(recordValue, [discriminatorField])
          : undefined
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
              <div className='config-view__record-fields'>
                {(itemSchema?.fields ?? []).map(field => renderField(key, recordValue, field))}
                {itemSchema == null && schema.unknownEditor === 'json' && (
                  <ComplexTextEditor
                    value={recordValue}
                    onChange={(updated) => {
                      onChange({ ...value, [key]: updated })
                    }}
                  />
                )}
              </div>
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
              disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
              onClick={() => {
                const nextSchema = schema.mode === 'discriminated'
                  ? (schema.schemas[newKind] ?? schema.unknownSchema)
                  : (schema.schemas[newKey] ?? schema.unknownSchema)
                const nextEntry = buildDefaultValue(nextSchema)

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
