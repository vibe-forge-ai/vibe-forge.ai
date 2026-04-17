import './ConfigSectionForm.scss'

import { Collapse, Empty, Input, InputNumber, Select, Slider, Switch } from 'antd'
import type { ReactNode } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'

import { normalizeSendShortcut, resolveSendShortcut } from '#~/utils/shortcutUtils'

import { ComplexTextEditor, StringArrayEditor } from './ConfigEditors'
import { DetailCollectionField } from './DetailListField'
import { FieldRow } from './ConfigFieldRow'
import { ShortcutInput } from './ConfigShortcutInput'
import type { ConfigDetailRoute } from './configDetail'
import { resolveConfigDetailRouteMeta, toDetailCollectionEntries } from './configDetail'
import type { FieldSpec } from './configSchema'
import { configGroupMeta, configGroupOrder, configSchema } from './configSchema'
import { RecommendedModelsItemEditor } from './RecommendedModelsItemEditor'
import {
  getFieldDescription,
  getFieldLabel,
  getTypeIcon,
  getValueByPath,
  getValueType,
  setValueByPath
} from './configUtils'
import type { TranslationFn } from './configUtils'
import {
  BooleanRecordEditor,
  KeyValueEditor,
  McpServersRecordEditor,
  ModelServicesRecordEditor,
  RecordJsonEditor,
  SchemaRecordEditor
} from './record-editors/index'

const directRecordSections = new Set(['models', 'modelServices', 'channels', 'adapters', 'plugins', 'mcp'])
const defaultGroupOrder = ['base', 'permissions', 'env', 'items', 'default']

export const SectionForm = ({
  sectionKey,
  fields: providedFields,
  uiSection,
  value,
  onChange,
  mergedModelServices,
  mergedAdapters,
  selectedModelService,
  detailRoute = null,
  onOpenDetailRoute,
  t
}: {
  sectionKey: string
  fields?: FieldSpec[]
  uiSection?: ConfigUiSection
  value: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  selectedModelService?: string
  detailRoute?: ConfigDetailRoute | null
  onOpenDetailRoute?: (route: ConfigDetailRoute) => void
  t: TranslationFn
}) => {
  const fields = providedFields ?? configSchema[sectionKey] ?? []
  const detailContext = {
    mergedModelServices,
    mergedAdapters,
    t
  }

  if (uiSection?.kind === 'recordMap') {
    const recordValue = (value != null && typeof value === 'object')
      ? value as Record<string, unknown>
      : {}
    if (uiSection.recordMap.mode === 'discriminated' && (uiSection.recordMap.entryKinds?.length ?? 0) === 0) {
      return (
        <RecordJsonEditor
          value={recordValue}
          onChange={onChange}
          t={t}
          keyPlaceholder={t('config.editor.fieldKey')}
        />
      )
    }
    return (
      <SchemaRecordEditor
        value={recordValue}
        schema={uiSection.recordMap}
        onChange={onChange}
        t={t}
        keyPlaceholder={uiSection.recordMap.keyPlaceholder ?? t('config.editor.fieldKey')}
      />
    )
  }

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
  const adapterOptions: Array<{ value: string; label: ReactNode }> = Object.keys(mergedAdapters).map(key => ({
    value: key,
    label: <span>{key}</span>
  }))

  const renderField = ({
    field,
    currentValue,
    onCurrentValueChange,
    keyPrefix
  }: {
    field: FieldSpec
    currentValue: unknown
    onCurrentValueChange: (nextValue: unknown) => void
    keyPrefix: string
  }) => {
    const fieldValue = getValueByPath(currentValue, field.path)
    const valueToUse = fieldValue !== undefined ? fieldValue : field.defaultValue
    const label = field.labelKey
      ? t(field.labelKey)
      : getFieldLabel(t, sectionKey, field.path, field.path[field.path.length - 1] ?? '')
    const description = field.descriptionKey
      ? t(field.descriptionKey)
      : getFieldDescription(t, sectionKey, field.path)
    const icon = field.icon ?? getTypeIcon(getValueType(valueToUse))
    const handleValueChange = (nextValue: unknown) => {
      onCurrentValueChange(setValueByPath(currentValue, field.path, nextValue))
    }

    let control: ReactNode = null
    const isStacked = ['multiline', 'json', 'record', 'string[]', 'detailCollection'].includes(field.type)

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
    } else if (field.type === 'detailCollection') {
      control = (
        <DetailCollectionField
          sectionKey={sectionKey}
          field={field}
          value={valueToUse}
          onChange={(next) => handleValueChange(next)}
          onOpenDetail={(route) => onOpenDetailRoute?.(route)}
          mergedModelServices={mergedModelServices}
          mergedAdapters={mergedAdapters}
          t={t}
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
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      } else if (field.recordKind === 'channels') {
        control = (
          <RecordJsonEditor
            value={recordValue}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      } else if (field.recordKind === 'mcpServers') {
        control = (
          <McpServersRecordEditor
            value={recordValue}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      } else if (field.recordKind === 'keyValue') {
        control = (
          <KeyValueEditor
            value={recordValue as Record<string, string>}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      } else if (field.recordKind === 'boolean') {
        control = (
          <BooleanRecordEditor
            value={recordValue as Record<string, boolean>}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      } else {
        control = (
          <RecordJsonEditor
            value={recordValue}
            onChange={handleValueChange}
            t={t}
            keyPlaceholder={getRecordKeyPlaceholder(sectionKey, field, t)}
          />
        )
      }
    } else if (field.type === 'shortcut') {
      const isMac = navigator.platform.includes('Mac')
      const rawValue = typeof valueToUse === 'string' ? valueToUse : ''
      const isSendMessageShortcut = field.shortcutKind === 'sendMessage'
      control = (
        <ShortcutInput
          value={rawValue}
          displayValue={isSendMessageShortcut ? resolveSendShortcut(rawValue, isMac) : undefined}
          onChange={(next) => handleValueChange(next)}
          placeholder={t('config.editor.shortcutPlaceholder')}
          normalizeShortcut={isSendMessageShortcut
            ? (next) => normalizeSendShortcut(next, isMac)
            : undefined}
          isMac={isMac}
          t={t}
        />
      )
    }

    if (directRecordSections.has(sectionKey) && field.type === 'record') {
      return (
        <div key={`${keyPrefix}:${field.path.join('.')}:${field.type}:${field.recordKind ?? ''}`}>
          {control}
        </div>
      )
    }

    return (
      <FieldRow
        key={`${keyPrefix}:${field.path.join('.')}:${field.type}:${field.labelKey ?? ''}:${field.recordKind ?? ''}`}
        title={label}
        description={description}
        icon={icon}
        layout={isStacked ? 'stacked' : 'inline'}
      >
        {control}
      </FieldRow>
    )
  }

  const renderFieldGroups = ({
    currentFields,
    currentValue,
    onCurrentValueChange,
    keyPrefix
  }: {
    currentFields: FieldSpec[]
    currentValue: unknown
    onCurrentValueChange: (nextValue: unknown) => void
    keyPrefix: string
  }) => {
    const groupedFields = currentFields.reduce<Record<string, FieldSpec[]>>((acc, field) => {
      const key = field.group ?? 'default'
      if (!acc[key]) acc[key] = []
      acc[key].push(field)
      return acc
    }, {})
    const orderedGroups = (configGroupOrder[sectionKey] ?? defaultGroupOrder).filter(key => groupedFields[key]?.length)

    return (
      <div className='config-view__field-stack'>
        {orderedGroups.map((groupKey) => {
          const groupFields = groupedFields[groupKey] ?? []
          if (groupKey === 'default') {
            if (directRecordSections.has(sectionKey)) {
              return (
                <div key={`${keyPrefix}:${groupKey}`}>
                  {groupFields.map(field => renderField({
                    field,
                    currentValue,
                    onCurrentValueChange,
                    keyPrefix
                  }))}
                </div>
              )
            }
            return (
              <div key={`${keyPrefix}:${groupKey}`} className='config-view__field-list'>
                {groupFields.map(field => renderField({
                  field,
                  currentValue,
                  onCurrentValueChange,
                  keyPrefix
                }))}
              </div>
            )
          }

          const groupMeta = configGroupMeta[sectionKey]?.[groupKey]
          const groupLabel = (() => {
            const labelKey = groupMeta?.labelKey
            if (labelKey) return t(labelKey)
            return groupKey === 'base'
              ? t('config.sectionGroups.base')
              : groupKey === 'models'
              ? t('config.sectionGroups.models')
              : groupKey === 'advanced'
              ? t('config.sectionGroups.advanced')
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
          >((acc, field) => {
            const meta = field.collapse
            if (!meta) return acc
            const existing = acc.get(meta.key)
            if (existing) {
              existing.fields.push(field)
            } else {
              acc.set(meta.key, { meta, fields: [field] })
            }
            return acc
          }, new Map())
          const collapseItems = Array.from(collapseGroups.values()).map(group => ({
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
                    checked={!getValueByPath(currentValue, group.meta.togglePath)}
                    onChange={(next) => {
                      onCurrentValueChange(setValueByPath(currentValue, group.meta.togglePath!, !next))
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
                {group.fields.map(field => renderField({
                  field,
                  currentValue,
                  onCurrentValueChange,
                  keyPrefix
                }))}
              </div>
            )
          }))

          const groupBody = (
            <div className='config-view__subsection-body'>
              {nonCollapseFields.map(field => renderField({
                field,
                currentValue,
                onCurrentValueChange,
                keyPrefix
              }))}
              {collapseItems.length > 0 && (
                <Collapse
                  className='config-view__collapse-group config-view__field-row'
                  ghost
                  items={collapseItems}
                />
              )}
            </div>
          )

          if (groupMeta?.collapsible === true) {
            return (
              <Collapse
                key={`${keyPrefix}:${groupKey}`}
                className='config-view__subsection-collapse'
                ghost
                expandIconPosition='end'
                expandIcon={({ isActive }) => (
                  <span
                    className={`material-symbols-rounded config-view__subsection-expand-icon${
                      isActive ? ' is-active' : ''
                    }`}
                  >
                    chevron_right
                  </span>
                )}
                defaultActiveKey={groupMeta.defaultExpanded === false ? [] : [groupKey]}
                items={[
                  {
                    key: groupKey,
                    label: <div className='config-view__subsection-title'>{groupLabel}</div>,
                    children: groupBody
                  }
                ]}
              />
            )
          }

          return (
            <div key={`${keyPrefix}:${groupKey}`} className='config-view__subsection'>
              <div className='config-view__subsection-title'>
                {groupLabel}
              </div>
              {groupBody}
            </div>
          )
        })}
      </div>
    )
  }

  const detailMeta = resolveConfigDetailRouteMeta({
    sectionKey,
    fields,
    value,
    route: detailRoute,
    detailContext,
    t
  })

  if (detailMeta != null) {
    const updateDetailItem = (nextItem: Record<string, unknown>) => {
      if (detailMeta.field.type !== 'detailCollection' || detailMeta.field.detailCollection == null) return

      if (detailMeta.field.detailCollection.collectionKind === 'list') {
        const nextItems = toDetailCollectionEntries({
          field: detailMeta.field,
          value: getValueByPath(value, detailMeta.field.path)
        }).map((entry) => (
          entry.index === detailMeta.itemIndex ? nextItem : entry.item
        ))
        onChange(setValueByPath(value, detailMeta.field.path, nextItems))
        return
      }

      onChange(setValueByPath(value, [...detailMeta.field.path, detailMeta.itemKey], nextItem))
    }

    if (detailMeta.field.detailCollection?.detailKind === 'recommendedModels') {
      return (
        <RecommendedModelsItemEditor
          value={detailMeta.item}
          onChange={updateDetailItem}
          mergedModelServices={mergedModelServices}
          t={t}
        />
      )
    }

    if ((detailMeta.field.detailCollection?.itemFields?.length ?? 0) > 0) {
      return renderFieldGroups({
        currentFields: detailMeta.field.detailCollection!.itemFields!,
        currentValue: detailMeta.item,
        onCurrentValueChange: updateDetailItem,
        keyPrefix: `detail:${detailMeta.field.path.join('.')}:${detailMeta.itemKey}`
      })
    }

    return <Empty description={t('common.noData')} image={null} />
  }

  return renderFieldGroups({
    currentFields: fields,
    currentValue: value,
    onCurrentValueChange: onChange,
    keyPrefix: sectionKey
  })
}

const getRecordKeyPlaceholder = (sectionKey: string, field: FieldSpec, t: TranslationFn) => {
  if (sectionKey === 'models') return t('config.editor.newModelSelectorName')
  if (sectionKey === 'modelServices') return t('config.editor.newModelServiceName')
  if (sectionKey === 'channels') return t('config.editor.newChannelName')
  if (sectionKey === 'adapters') return t('config.editor.newAdapterName')
  if (sectionKey === 'plugins') return t('config.editor.newPluginName')
  if (sectionKey === 'mcp') return t('config.editor.newMcpServerName')
  if (sectionKey === 'general' && field.path.join('.') === 'env') return t('config.editor.newEnvVarName')
  return t('config.editor.fieldKey')
}
