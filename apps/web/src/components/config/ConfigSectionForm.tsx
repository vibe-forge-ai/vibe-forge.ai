import './ConfigSectionForm.scss'

import { Collapse, Empty, Input, InputNumber, Select, Slider, Switch } from 'antd'
import type { ReactNode } from 'react'

import { ComplexTextEditor, StringArrayEditor } from './ConfigEditors'
import { FieldRow } from './ConfigFieldRow'
import { ShortcutInput } from './ConfigShortcutInput'
import type { FieldSpec } from './configSchema'
import { configGroupMeta, configSchema } from './configSchema'
import {
  getFieldDescription,
  getFieldLabel,
  getTypeIcon,
  getValueByPath,
  getValueType,
  isEmptyValue,
  setValueByPath
} from './configUtils'
import type { TranslationFn } from './configUtils'
import {
  BooleanRecordEditor,
  KeyValueEditor,
  McpServersRecordEditor,
  ModelServicesRecordEditor,
  RecordJsonEditor
} from './recordEditors/index'

export const SectionForm = ({
  sectionKey,
  fields: providedFields,
  value,
  onChange,
  mergedModelServices,
  mergedAdapters,
  selectedModelService,
  t
}: {
  sectionKey: string
  fields?: FieldSpec[]
  value: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  selectedModelService?: string
  t: TranslationFn
}) => {
  const fields = providedFields ?? configSchema[sectionKey] ?? []
  if (fields.length === 0) {
    return <Empty description={t('common.noData')} image={null} />
  }
  const directRecordSections = new Set(['modelServices', 'adapters', 'plugins', 'mcp'])

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
  const adapterOptions: Array<{ value: string; label: ReactNode }> = Object.keys(mergedAdapters)
    .map(key => ({
      value: key,
      label: <span>{key}</span>
    }))

  const groupedFields = fields.reduce<Record<string, FieldSpec[]>>((acc, field) => {
    const key = field.group ?? 'default'
    if (!acc[key]) acc[key] = []
    acc[key].push(field)
    return acc
  }, {})
  const orderedGroups = ['base', 'permissions', 'env', 'items', 'default'].filter(key => groupedFields[key]?.length)
  const notificationEventOrder = ['completed', 'failed', 'terminated', 'waiting_input']

  const getRecordKeyPlaceholder = (field: FieldSpec) => {
    if (sectionKey === 'modelServices') return t('config.editor.newModelServiceName')
    if (sectionKey === 'adapters') return t('config.editor.newAdapterName')
    if (sectionKey === 'plugins') {
      if (field.path.join('.') === 'extraKnownMarketplaces') return t('config.editor.newMarketplaceName')
      return t('config.editor.newPluginName')
    }
    if (sectionKey === 'mcp') return t('config.editor.newMcpServerName')
    if (sectionKey === 'general' && field.path.join('.') === 'env') return t('config.editor.newEnvVarName')
    return t('config.editor.fieldKey')
  }

  const renderField = (field: FieldSpec) => {
    const fieldValue = getValueByPath(value, field.path)
    const valueToUse = fieldValue !== undefined ? fieldValue : field.defaultValue
    const label = field.labelKey
      ? t(field.labelKey)
      : getFieldLabel(t, sectionKey, field.path, field.path[field.path.length - 1] ?? '')
    const description = field.descriptionKey
      ? t(field.descriptionKey)
      : getFieldDescription(t, sectionKey, field.path)
    const icon = field.icon ?? getTypeIcon(getValueType(valueToUse))

    const handleValueChange = (nextValue: unknown) => {
      const nextSectionValue = setValueByPath(value, field.path, nextValue)
      onChange(nextSectionValue)
    }

    let control: ReactNode = null
    const isStacked = ['multiline', 'json', 'record', 'string[]'].includes(field.type)

    if (field.type === 'string') {
      const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined
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
            placeholder={placeholder}
          />
        )
      }
    } else if (field.type === 'multiline') {
      const currentText = typeof valueToUse === 'string' ? valueToUse : ''
      const placeholder = field.placeholderKey ? t(field.placeholderKey) : t('config.editor.multilinePlaceholder')
      control = (
        <div className='config-view__multiline'>
          <Input.TextArea
            className='config-view__multiline-input'
            value={currentText}
            onChange={(event) => handleValueChange(event.target.value)}
            autoSize={{ minRows: 3 }}
            placeholder={placeholder}
          />
        </div>
      )
    } else if (field.type === 'number') {
      const isNotificationVolume = field.path.join('.') === 'notifications.volume'
      if (isNotificationVolume) {
        const sliderValue = typeof valueToUse === 'number' ? valueToUse : 0
        control = (
          <Slider
            className='config-view__slider'
            min={0}
            max={100}
            step={1}
            value={sliderValue}
            onChange={(next) => handleValueChange(typeof next === 'number' ? next : 0)}
          />
        )
      } else {
        control = (
          <InputNumber
            value={typeof valueToUse === 'number' ? valueToUse : 0}
            onChange={(next) => handleValueChange(typeof next === 'number' ? next : 0)}
          />
        )
      }
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
      const isDefaultAdapter = sectionKey === 'general' && field.path.join('.') === 'defaultAdapter'
      const isDefaultModelService = sectionKey === 'general' && field.path.join('.') === 'defaultModelService'
      const isDefaultModel = sectionKey === 'general' && field.path.join('.') === 'defaultModel'
      const options: Array<{ value: string; label: ReactNode }> = isDefaultModelService
        ? modelServiceOptions
        : isDefaultModel
        ? modelOptions
        : isDefaultAdapter
        ? adapterOptions
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
            isDefaultAdapter
              ? 'config.editor.defaultAdapterPlaceholder'
              : isDefaultModelService
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
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(field)}
          />
        )
      } else if (field.recordKind === 'mcpServers') {
        control = (
          <McpServersRecordEditor
            value={recordValue}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(field)}
          />
        )
      } else if (field.recordKind === 'keyValue') {
        control = (
          <KeyValueEditor
            value={recordValue as Record<string, string>}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(field)}
          />
        )
      } else if (field.recordKind === 'boolean') {
        control = (
          <BooleanRecordEditor
            value={recordValue as Record<string, boolean>}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(field)}
          />
        )
      } else {
        control = (
          <RecordJsonEditor
            value={recordValue}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(field)}
          />
        )
      }
    } else if (field.type === 'shortcut') {
      const isMac = navigator.platform.includes('Mac')
      control = (
        <ShortcutInput
          value={typeof valueToUse === 'string' ? valueToUse : ''}
          onChange={(next) => handleValueChange(next)}
          placeholder={t('config.editor.shortcutPlaceholder')}
          isMac={isMac}
          t={t}
        />
      )
    }

    if (directRecordSections.has(sectionKey) && field.type === 'record') {
      return (
        <div key={`${field.path.join('.')}-${field.type}-${field.recordKind ?? ''}`}>
          {control}
        </div>
      )
    }
    return (
      <FieldRow
        key={`${field.path.join('.')}-${field.type}-${field.labelKey ?? ''}-${field.recordKind ?? ''}`}
        title={label}
        description={description}
        icon={icon}
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
        const hideEmptyGroups = new Set(['base', 'permissions'])
        if (hideEmptyGroups.has(groupKey)) {
          const hasGroupValues = groupFields.some((field) => {
            const fieldValue = getValueByPath(value, field.path)
            if (typeof fieldValue === 'boolean') return fieldValue
            return !isEmptyValue(fieldValue)
          })
          if (!hasGroupValues) {
            return null
          }
        }
        if (groupKey === 'default') {
          if (directRecordSections.has(sectionKey)) {
            return (
              <div key={groupKey}>
                {groupFields.map(renderField)}
              </div>
            )
          }
          return (
            <div key={groupKey} className='config-view__field-list'>
              {groupFields.map(renderField)}
            </div>
          )
        }
        const groupLabel = (() => {
          const labelKey = configGroupMeta[sectionKey]?.[groupKey]?.labelKey
          if (labelKey) return t(labelKey)
          return groupKey === 'base'
            ? t('config.sectionGroups.base')
            : groupKey === 'permissions'
            ? t('config.sectionGroups.permissions')
            : groupKey === 'env'
            ? t('config.sectionGroups.env')
            : sectionKey === 'plugins'
            ? t('config.sectionGroups.plugins')
            : t('config.sectionGroups.items')
        })()
        const visibleFields = groupFields.filter(field => field.hidden !== true)
        const collapseFields = visibleFields.filter(field => field.collapse != null)
        const nonCollapseFields = visibleFields.filter(field => field.collapse == null)
        const collapseGroups = collapseFields.reduce<
          Map<string, { meta: NonNullable<FieldSpec['collapse']>; fields: FieldSpec[] }>
        >(
          (acc, field) => {
            const meta = field.collapse
            if (!meta) return acc
            const existing = acc.get(meta.key)
            if (existing) {
              existing.fields.push(field)
            } else {
              acc.set(meta.key, { meta, fields: [field] })
            }
            return acc
          },
          new Map()
        )
        const collapseItems = Array.from(collapseGroups.values()).map((group) => ({
          key: group.meta.key,
          collapsible: 'header' as const,
          label: (
            <div className='config-view__collapse-header'>
              <div className='config-view__collapse-header-main'>
                <div className='config-view__collapse-title'>
                  {t(group.meta.labelKey)}
                </div>
                {group.meta.descKey && (
                  <div className='config-view__collapse-desc'>
                    {t(group.meta.descKey)}
                  </div>
                )}
              </div>
              {group.meta.togglePath && (
                <Switch
                  checked={!getValueByPath(value, group.meta.togglePath)}
                  onChange={(next) => {
                    const nextValue = setValueByPath(value, group.meta.togglePath!, !next)
                    onChange(nextValue)
                  }}
                  onClick={(_, event) => {
                    event.stopPropagation()
                  }}
                />
              )}
            </div>
          ),
          children: (
            <div className='config-view__field-list'>
              {group.fields.map(renderField)}
            </div>
          )
        }))
        return (
          <div key={groupKey} className='config-view__subsection'>
            <div className='config-view__subsection-title'>
              {groupLabel}
            </div>
            <div className='config-view__subsection-body'>
              {nonCollapseFields.map(renderField)}
              {collapseItems.length > 0 && (
                <Collapse
                  className='config-view__collapse-group config-view__field-row'
                  ghost
                  items={collapseItems}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
