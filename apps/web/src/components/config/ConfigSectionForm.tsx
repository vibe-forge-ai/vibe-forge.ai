import './ConfigSectionForm.scss'

import { Empty, Input, InputNumber, Select, Switch } from 'antd'
import type { ReactNode } from 'react'

import { ComplexTextEditor, StringArrayEditor } from './ConfigEditors'
import { FieldRow } from './ConfigFieldRow'
import { BooleanRecordEditor, KeyValueEditor, McpServersRecordEditor, ModelServicesRecordEditor, RecordJsonEditor } from './ConfigRecordEditors'
import { getFieldDescription, getFieldLabel, getTypeIcon, getValueByPath, getValueType, isEmptyValue, setValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'

type FieldValueType = 'string' | 'number' | 'boolean' | 'string[]' | 'select' | 'json' | 'multiline' | 'record'

type RecordKind = 'json' | 'modelServices' | 'mcpServers' | 'boolean' | 'keyValue'

interface FieldOption {
  value: string
  label: string
}

interface FieldSpec {
  path: string[]
  type: FieldValueType
  defaultValue: unknown
  options?: FieldOption[]
  placeholderKey?: string
  labelKey?: string
  descriptionKey?: string
  group?: 'base' | 'items'
  recordKind?: RecordKind
  sensitive?: boolean
}

const configSchema: Record<string, FieldSpec[]> = {
  general: [
    { path: ['baseDir'], type: 'string', defaultValue: '' },
    { path: ['defaultAdapter'], type: 'string', defaultValue: '' },
    { path: ['defaultModelService'], type: 'select', defaultValue: '' },
    { path: ['defaultModel'], type: 'select', defaultValue: '' },
    { path: ['announcements'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'allow'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'deny'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'ask'], type: 'string[]', defaultValue: [] },
    { path: ['env'], type: 'record', recordKind: 'keyValue', defaultValue: {} }
  ],
  conversation: [
    {
      path: ['style'],
      type: 'select',
      defaultValue: 'friendly',
      options: [
        { value: 'friendly', label: 'config.options.conversation.friendly' },
        { value: 'programmatic', label: 'config.options.conversation.programmatic' }
      ]
    },
    { path: ['customInstructions'], type: 'multiline', defaultValue: '' }
  ],
  modelServices: [
    {
      path: [],
      type: 'record',
      recordKind: 'modelServices',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.modelServices.items.label',
      descriptionKey: 'config.fields.modelServices.items.desc'
    }
  ],
  adapters: [
    {
      path: [],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.adapters.items.label',
      descriptionKey: 'config.fields.adapters.items.desc'
    }
  ],
  plugins: [
    {
      path: ['plugins'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.plugins.items.label',
      descriptionKey: 'config.fields.plugins.items.desc'
    },
    {
      path: ['enabledPlugins'],
      type: 'record',
      recordKind: 'boolean',
      defaultValue: {},
      group: 'base',
      labelKey: 'config.fields.plugins.enabled.label',
      descriptionKey: 'config.fields.plugins.enabled.desc'
    },
    {
      path: ['extraKnownMarketplaces'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'base',
      labelKey: 'config.fields.plugins.marketplaces.label',
      descriptionKey: 'config.fields.plugins.marketplaces.desc'
    }
  ],
  mcp: [
    { path: ['defaultIncludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base' },
    { path: ['defaultExcludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base' },
    { path: ['noDefaultVibeForgeMcpServer'], type: 'boolean', defaultValue: false, group: 'base' },
    {
      path: ['mcpServers'],
      type: 'record',
      recordKind: 'mcpServers',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.mcp.items.label',
      descriptionKey: 'config.fields.mcp.items.desc'
    }
  ],
  shortcuts: [
    { path: ['newSession'], type: 'string', defaultValue: '' },
    { path: ['openConfig'], type: 'string', defaultValue: '' }
  ]
}

export const SectionForm = ({
  sectionKey,
  value,
  onChange,
  mergedModelServices,
  selectedModelService,
  t
}: {
  sectionKey: string
  value: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  selectedModelService?: string
  t: TranslationFn
}) => {
  const fields = configSchema[sectionKey] ?? []
  if (fields.length === 0) {
    return <Empty description={t('common.noData')} image={null} />
  }

  const modelServiceEntries = Object.entries(mergedModelServices)
  const modelServiceOptions: Array<{ value: string; label: ReactNode }> = modelServiceEntries.map(([key, entry]) => {
    const record = (entry != null && typeof entry === 'object') ? entry as Record<string, unknown> : {}
    const title = typeof record.title === 'string' && record.title.trim() !== '' ? record.title : key
    const description = typeof record.description === 'string' ? record.description : ''
    return {
      value: key,
      label: (
        <div className='config-view__option'>
          <div className='config-view__option-title'>{title}</div>
          {description !== '' && (
            <div className='config-view__option-desc'>{description}</div>
          )}
        </div>
      )
    }
  })
  const selectedServiceRecord = selectedModelService
    ? mergedModelServices[selectedModelService]
    : undefined
  const selectedServiceModels = (selectedServiceRecord != null && typeof selectedServiceRecord === 'object')
    ? (selectedServiceRecord as Record<string, unknown>).models
    : undefined
  const modelOptions: Array<{ value: string; label: ReactNode }> = Array.isArray(selectedServiceModels)
    ? selectedServiceModels.filter(item => typeof item === 'string').map(item => ({
      value: item,
      label: <span>{item}</span>
    }))
    : []

  const groupedFields = fields.reduce<Record<string, FieldSpec[]>>((acc, field) => {
    const key = field.group ?? 'default'
    if (!acc[key]) acc[key] = []
    acc[key].push(field)
    return acc
  }, {})
  const orderedGroups = ['base', 'items', 'default'].filter(key => groupedFields[key]?.length)

  const renderField = (field: FieldSpec) => {
    const fieldValue = getValueByPath(value, field.path)
    const valueToUse = fieldValue !== undefined ? fieldValue : field.defaultValue
    const label = field.labelKey
      ? t(field.labelKey)
      : getFieldLabel(t, sectionKey, field.path, field.path[field.path.length - 1] ?? '')
    const description = field.descriptionKey
      ? t(field.descriptionKey)
      : getFieldDescription(t, sectionKey, field.path)

    const handleValueChange = (nextValue: unknown) => {
      const nextSectionValue = setValueByPath(value, field.path, nextValue)
      onChange(nextSectionValue)
    }

    let control: ReactNode = null
    const isStacked = ['multiline', 'json', 'record', 'string[]'].includes(field.type)

    if (field.type === 'string') {
      if (field.sensitive === true) {
        control = (
          <Input.Password
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => handleValueChange(event.target.value)}
            placeholder={t('config.editor.secretPlaceholder')}
          />
        )
      } else {
        control = (
          <Input
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => handleValueChange(event.target.value)}
          />
        )
      }
    } else if (field.type === 'multiline') {
      const currentText = typeof valueToUse === 'string' ? valueToUse : ''
      control = (
        <div className='config-view__multiline'>
          <Input.TextArea
            className='config-view__multiline-input'
            value={currentText}
            onChange={(event) => handleValueChange(event.target.value)}
            autoSize={{ minRows: 3 }}
            placeholder={t('config.editor.multilinePlaceholder')}
          />
        </div>
      )
    } else if (field.type === 'number') {
      control = (
        <InputNumber
          value={typeof valueToUse === 'number' ? valueToUse : 0}
          onChange={(next) => handleValueChange(typeof next === 'number' ? next : 0)}
        />
      )
    } else if (field.type === 'boolean') {
      control = (
        <Switch
          checked={Boolean(valueToUse)}
          onChange={(next) => handleValueChange(next)}
        />
      )
    } else if (field.type === 'string[]') {
      const current = Array.isArray(valueToUse) ? valueToUse.filter(item => typeof item === 'string') : []
      control = (
        <StringArrayEditor
          value={current}
          onChange={(next) => handleValueChange(next)}
          t={t}
        />
      )
    } else if (field.type === 'select') {
      const isDefaultModelService = sectionKey === 'general' && field.path.join('.') === 'defaultModelService'
      const isDefaultModel = sectionKey === 'general' && field.path.join('.') === 'defaultModel'
      const options: Array<{ value: string; label: ReactNode }> = isDefaultModelService
        ? modelServiceOptions
        : isDefaultModel
        ? modelOptions
        : (field.options ?? []).map(option => ({
          value: option.value,
          label: <span>{t(option.label)}</span>
        }))
      control = (
        <Select
          value={typeof valueToUse === 'string' && valueToUse !== '' ? valueToUse : undefined}
          options={options}
          onChange={(next) => handleValueChange(next)}
          allowClear
          disabled={isDefaultModel && modelOptions.length === 0}
          placeholder={t(
            isDefaultModelService
              ? 'config.editor.defaultModelServicePlaceholder'
              : 'config.editor.defaultModelPlaceholder'
          )}
        />
      )
    } else if (field.type === 'json') {
      control = (
        <ComplexTextEditor
          value={valueToUse}
          onChange={handleValueChange}
        />
      )
    } else if (field.type === 'record') {
      const recordValue = (valueToUse != null && typeof valueToUse === 'object')
        ? valueToUse as Record<string, unknown>
        : {}
      if (field.recordKind === 'modelServices') {
        control = (
          <ModelServicesRecordEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'mcpServers') {
        control = (
          <McpServersRecordEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'keyValue') {
        control = (
          <KeyValueEditor
            value={recordValue as Record<string, string>}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'boolean') {
        control = (
          <BooleanRecordEditor
            value={recordValue as Record<string, boolean>}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else {
        control = (
          <RecordJsonEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      }
    }

    return (
      <FieldRow
        key={`${field.path.join('.')}-${field.type}-${field.labelKey ?? ''}-${field.recordKind ?? ''}`}
        title={label}
        description={description}
        icon={getTypeIcon(getValueType(valueToUse))}
        layout={isStacked ? 'stacked' : 'inline'}
      >
        {control}
      </FieldRow>
    )
  }

  return (
    <div className='config-view__field-stack'>
      {orderedGroups.map((groupKey) => {
        const groupFields = groupedFields[groupKey] ?? []
        if (groupKey === 'base') {
          if (sectionKey === 'plugins') {
            return (
              <div key={groupKey} className='config-view__subsection'>
                <div className='config-view__subsection-title'>
                  {t('config.sectionGroups.base')}
                </div>
                <div className='config-view__subsection-body'>
                  {groupFields.map(renderField)}
                </div>
              </div>
            )
          }
          const hasBaseValues = groupFields.some((field) => {
            const fieldValue = getValueByPath(value, field.path)
            if (typeof fieldValue === 'boolean') return fieldValue
            return !isEmptyValue(fieldValue)
          })
          if (!hasBaseValues) {
            return null
          }
        }
        if (groupKey === 'default') {
          return (
            <div key={groupKey} className='config-view__field-list'>
              {groupFields.map(renderField)}
            </div>
          )
        }
        return (
          <div key={groupKey} className='config-view__subsection'>
            <div className='config-view__subsection-title'>
              {groupKey === 'base'
                ? t('config.sectionGroups.base')
                : sectionKey === 'plugins'
                ? t('config.sectionGroups.plugins')
                : t('config.sectionGroups.items')}
            </div>
            <div className='config-view__subsection-body'>
              {groupFields.map(renderField)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
