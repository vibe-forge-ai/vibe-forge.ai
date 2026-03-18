import './ChannelRecordEditor.scss'

import { Button, Input, InputNumber, Select, Switch, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { ZodRawShape, ZodTypeAny } from 'zod'
import { z } from 'zod'

import type { ChannelDescriptor } from '@vibe-forge/core/channel'
import { channelBaseSchema } from '@vibe-forge/core/channel'

import { ComplexTextEditor, StringArrayEditor } from '../ConfigEditors'
import { FieldRow } from '../ConfigFieldRow'
import { channelDefinitions } from '../channelDefinitions'
import { getTypeIcon, isSensitiveKey } from '../configUtils'
import type { TranslationFn } from '../configUtils'

type ChannelRecordValue = Record<string, unknown>

const getObjectShape = (schema: ZodTypeAny): ZodRawShape => {
  if (schema instanceof z.ZodObject) return schema.shape
  if (schema instanceof z.ZodEffects) return getObjectShape(schema.innerType())
  if (schema instanceof z.ZodOptional) return getObjectShape(schema.unwrap())
  if (schema instanceof z.ZodDefault) return getObjectShape(schema.removeDefault())
  if (schema instanceof z.ZodNullable) return getObjectShape(schema.unwrap())
  return {}
}

const unwrapSchema = (schema: ZodTypeAny): ZodTypeAny => {
  if (schema instanceof z.ZodEffects) return unwrapSchema(schema.innerType())
  if (schema instanceof z.ZodOptional) return unwrapSchema(schema.unwrap())
  if (schema instanceof z.ZodDefault) return unwrapSchema(schema.removeDefault())
  if (schema instanceof z.ZodNullable) return unwrapSchema(schema.unwrap())
  return schema
}

const getDefaultValue = (schema: ZodTypeAny): unknown => {
  if (schema instanceof z.ZodDefault) return schema._def.defaultValue()
  if (schema instanceof z.ZodOptional) return undefined
  if (schema instanceof z.ZodNullable) return null
  if (schema instanceof z.ZodLiteral) return schema.value
  if (schema instanceof z.ZodEnum) return schema.options[0]
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema.enum)
    return values.length > 0 ? values[0] : undefined
  }
  if (schema instanceof z.ZodString) return ''
  if (schema instanceof z.ZodNumber) return 0
  if (schema instanceof z.ZodBoolean) return false
  if (schema instanceof z.ZodArray) return []
  if (schema instanceof z.ZodObject) {
    const shape = getObjectShape(schema)
    return Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, getDefaultValue(value)]))
  }
  if (schema instanceof z.ZodRecord) return {}
  if (schema instanceof z.ZodEffects) return getDefaultValue(schema.innerType())
  return undefined
}

const toLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase())

const buildRecordDefaults = (definition: ChannelDescriptor) => {
  const shape = getObjectShape(definition.configSchema)
  const entries = Object.entries(shape)
  return entries.reduce<Record<string, unknown>>((acc, [key, schema]) => {
    acc[key] = getDefaultValue(schema)
    return acc
  }, {})
}

const getChannelDefinition = (type: string | undefined) =>
  channelDefinitions.find(definition => definition.type === type)

export const ChannelRecordEditor = ({
  value,
  onChange,
  t,
  keyPlaceholder
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const [newType, setNewType] = useState(channelDefinitions[0]?.type ?? '')
  const entries = useMemo(() => Object.entries(value), [value])
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(entries.map(([key]) => [key, true]))
  ))
  const baseKeys = useMemo(() => new Set(Object.keys(getObjectShape(channelBaseSchema))), [])
  const typeOptions = useMemo(() =>
    channelDefinitions.map(definition => ({
      value: definition.type,
      label: definition.label
    })), [])

  useEffect(() => {
    setCollapsedKeys(prev => {
      const next: Record<string, boolean> = {}
      for (const [key] of entries) {
        next[key] = prev[key] ?? true
      }
      return next
    })
  }, [entries])

  const updateChannel = (key: string, nextValue: ChannelRecordValue) => {
    onChange({ ...value, [key]: nextValue })
  }

  const renderField = (
    channelKey: string,
    recordValue: ChannelRecordValue,
    fieldKey: string,
    fieldSchema: ZodTypeAny
  ) => {
    const rawSchema = unwrapSchema(fieldSchema)
    const description = rawSchema.description ?? ''
    const label = toLabel(fieldKey)
    const currentValue = recordValue[fieldKey]
    const valueToUse = currentValue !== undefined ? currentValue : getDefaultValue(fieldSchema)

    if (rawSchema instanceof z.ZodString) {
      const isSensitive = isSensitiveKey(fieldKey)
      return (
        <FieldRow key={fieldKey} title={label} description={description} icon={getTypeIcon('string')}>
          {isSensitive
            ? (
              <Input.Password
                value={typeof valueToUse === 'string' ? valueToUse : ''}
                onChange={(event) => {
                  updateChannel(channelKey, { ...recordValue, [fieldKey]: event.target.value })
                }}
                placeholder={t('config.editor.secretPlaceholder')}
              />
            )
            : (
              <Input
                value={typeof valueToUse === 'string' ? valueToUse : ''}
                onChange={(event) => {
                  updateChannel(channelKey, { ...recordValue, [fieldKey]: event.target.value })
                }}
              />
            )}
        </FieldRow>
      )
    }

    if (rawSchema instanceof z.ZodNumber) {
      return (
        <FieldRow key={fieldKey} title={label} description={description} icon={getTypeIcon('number')}>
          <InputNumber
            value={typeof valueToUse === 'number' ? valueToUse : 0}
            onChange={(nextValue) => {
              updateChannel(channelKey, { ...recordValue, [fieldKey]: nextValue ?? 0 })
            }}
          />
        </FieldRow>
      )
    }

    if (rawSchema instanceof z.ZodBoolean) {
      return (
        <FieldRow key={fieldKey} title={label} description={description} icon={getTypeIcon('boolean')}>
          <Switch
            checked={Boolean(valueToUse)}
            onChange={(checked) => {
              updateChannel(channelKey, { ...recordValue, [fieldKey]: checked })
            }}
          />
        </FieldRow>
      )
    }

    if (rawSchema instanceof z.ZodEnum || rawSchema instanceof z.ZodNativeEnum) {
      const optionValues: string[] = (
        rawSchema instanceof z.ZodEnum
          ? rawSchema.options
          : Object.values(rawSchema.enum)
      ).map((option: string | number) => String(option))
      return (
        <FieldRow key={fieldKey} title={label} description={description} icon={getTypeIcon('string')}>
          <Select
            value={typeof valueToUse === 'string' ? valueToUse : undefined}
            options={optionValues.map((option) => ({ value: option, label: option }))}
            onChange={(nextValue) => {
              updateChannel(channelKey, { ...recordValue, [fieldKey]: nextValue })
            }}
          />
        </FieldRow>
      )
    }

    if (rawSchema instanceof z.ZodArray) {
      const inner = unwrapSchema(rawSchema.element)
      if (inner instanceof z.ZodString) {
        const items = Array.isArray(valueToUse)
          ? valueToUse.filter(item => typeof item === 'string')
          : []
        return (
          <FieldRow
            key={fieldKey}
            title={label}
            description={description}
            icon={getTypeIcon('array')}
            layout='stacked'
          >
            <StringArrayEditor
              value={items}
              onChange={(nextValue) => {
                updateChannel(channelKey, { ...recordValue, [fieldKey]: nextValue })
              }}
              t={t}
            />
          </FieldRow>
        )
      }
      return (
        <FieldRow
          key={fieldKey}
          title={label}
          description={description}
          icon={getTypeIcon('array')}
          layout='stacked'
        >
          <ComplexTextEditor
            value={Array.isArray(valueToUse) ? valueToUse : []}
            onChange={(nextValue) => {
              updateChannel(channelKey, { ...recordValue, [fieldKey]: nextValue })
            }}
          />
        </FieldRow>
      )
    }

    return (
      <FieldRow
        key={fieldKey}
        title={label}
        description={description}
        icon={getTypeIcon('object')}
        layout='stacked'
      >
        <ComplexTextEditor
          value={valueToUse ?? {}}
          onChange={(nextValue) => {
            updateChannel(channelKey, { ...recordValue, [fieldKey]: nextValue })
          }}
        />
      </FieldRow>
    )
  }

  return (
    <div className='config-view__record-list'>
      <div className='config-view__record-add'>
        <div className='config-view__record-add-inputs'>
          <Input
            value={newKey}
            placeholder={keyPlaceholder}
            onChange={(event) => setNewKey(event.target.value)}
          />
          <Select
            value={newType}
            options={typeOptions}
            onChange={(nextValue) => setNewType(nextValue)}
          />
          <Tooltip title={t('common.confirm')}>
            <Button
              size='small'
              type='primary'
              className='config-view__icon-button'
              aria-label={t('common.confirm')}
              icon={<span className='material-symbols-rounded'>check</span>}
              disabled={newKey.trim() === '' || Object.hasOwn(value, newKey) || newType === ''}
              onClick={() => {
                const definition = getChannelDefinition(newType)
                if (!definition) return
                onChange({
                  ...value,
                  [newKey]: buildRecordDefaults(definition)
                })
                setNewKey('')
              }}
            />
          </Tooltip>
        </div>
      </div>
      {entries.map(([key, itemValue]) => {
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as ChannelRecordValue
          : {}
        const type = typeof recordValue.type === 'string' ? recordValue.type : undefined
        const definition = getChannelDefinition(type)
        const titleValue = typeof recordValue.title === 'string' ? recordValue.title : ''
        const descriptionValue = typeof recordValue.description === 'string' ? recordValue.description : ''
        const displayName = titleValue.trim() !== '' ? titleValue : key
        const typeLabel = definition?.label ?? type ?? t('config.editor.unknownChannelType')
        const isCollapsed = collapsedKeys[key] === true
        const shape = definition ? getObjectShape(definition.configSchema) : {}
        const fieldEntries = Object.entries(shape)
          .filter(([fieldKey]) => fieldKey !== 'type')
          .sort(([a], [b]) => {
            const order = ['title', 'description', 'enabled', 'admins']
            const aIndex = order.indexOf(a)
            const bIndex = order.indexOf(b)
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
            if (aIndex === -1) return 1
            if (bIndex === -1) return -1
            return aIndex - bIndex
          })

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
                  <div>{displayName}</div>
                  <div className='config-view__record-subtitle'>
                    {key} · {typeLabel}
                  </div>
                  {descriptionValue !== '' && (
                    <div className='config-view__record-desc'>{descriptionValue}</div>
                  )}
                </div>
              </div>
              <div className='config-view__record-actions'>
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
            </div>
            <div className='config-view__record-body'>
              <div className='config-view__record-fields'>
                <FieldRow
                  title={t('config.editor.channelType')}
                  description={definition?.description ?? ''}
                  icon={getTypeIcon('string')}
                >
                  <Select
                    value={type}
                    options={typeOptions}
                    onChange={(nextType) => {
                      const nextDefinition = getChannelDefinition(nextType)
                      if (!nextDefinition) return
                      const defaults = buildRecordDefaults(nextDefinition)
                      const preserved = Object.fromEntries(
                        Object.entries(recordValue).filter(([fieldKey]) => baseKeys.has(fieldKey))
                      )
                      updateChannel(key, { ...defaults, ...preserved, type: nextType })
                    }}
                  />
                </FieldRow>
                {fieldEntries.map(([fieldKey, fieldSchema]) => (
                  renderField(key, recordValue, fieldKey, fieldSchema)
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
