import './ConfigSectionForm.scss'

import { Button, Collapse, Empty, Input, InputNumber, Select, Slider, Switch } from 'antd'
import type { ReactNode } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'

import { normalizeSendShortcut, resolveSendShortcut } from '#~/utils/shortcutUtils'

import { DisplayValue } from './ConfigDisplayValue'
import { ComplexTextEditor, StringArrayEditor } from './ConfigEditors'
import { FieldRow } from './ConfigFieldRow'
import { ShortcutInput } from './ConfigShortcutInput'
import { DetailCollectionField } from './DetailListField'
import { McpServerItemEditor } from './McpServerItemEditor'
import { RecommendedModelsItemEditor } from './RecommendedModelsItemEditor'
import type { ConfigDetailRoute } from './configDetail'
import { resolveConfigDetailRouteMeta } from './configDetail'
import type { FieldSpec } from './configSchema'
import { configGroupMeta, configGroupOrder, configSchema } from './configSchema'
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
  SchemaObjectEditor,
  SchemaRecordEditor
} from './record-editors/index'
import { resolveConfigUiRecordEntry } from './record-editors/schemaRecordUtils'

const directRecordSections = new Set(['models'])
const directDetailSections = new Set(['modelServices', 'channels', 'adapters'])
const defaultGroupOrder = ['base', 'permissions', 'env', 'items', 'default']

export const SectionForm = ({
  sectionKey,
  fields: providedFields,
  uiSection,
  value,
  resolvedValue,
  onChange,
  mergedModelServices,
  mergedAdapters,
  selectedModelService,
  worktreeEnvironmentOptions,
  detailRoute = null,
  onOpenDetailRoute,
  t
}: {
  sectionKey: string
  fields?: FieldSpec[]
  uiSection?: ConfigUiSection
  value: unknown
  resolvedValue?: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  selectedModelService?: string
  worktreeEnvironmentOptions?: Array<{ value: string; label: ReactNode }>
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

  if (uiSection?.kind === 'recordMap' && fields.length === 0) {
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

  const renderInheritedReadonlyControl = ({
    fieldValue,
    fieldPath,
    onOverride
  }: {
    fieldValue: unknown
    fieldPath: string[]
    onOverride?: () => void
  }) => (
    <div className='config-view__field-readonly'>
      <div className='config-view__field-readonly-value'>
        <DisplayValue value={fieldValue} sectionKey={sectionKey} path={fieldPath} t={t} />
      </div>
      {onOverride != null && (
        <Button size='small' onClick={onOverride}>
          {t('config.detail.override')}
        </Button>
      )}
    </div>
  )

  const renderField = ({
    field,
    currentValue,
    currentResolvedValue,
    onCurrentValueChange,
    keyPrefix,
    readOnly = false
  }: {
    field: FieldSpec
    currentValue: unknown
    currentResolvedValue?: unknown
    onCurrentValueChange: (nextValue: unknown) => void
    keyPrefix: string
    readOnly?: boolean
  }) => {
    const fieldValue = getValueByPath(currentValue, field.path)
    const resolvedFieldValue = getValueByPath(currentResolvedValue, field.path)
    const hasLocalValue = fieldValue !== undefined
    const hasResolvedValue = resolvedFieldValue !== undefined
    const inheritedOnly = !hasLocalValue && hasResolvedValue
    const canInlineOverride = field.type === 'string' ||
      field.type === 'multiline' ||
      field.type === 'number' ||
      field.type === 'boolean' ||
      field.type === 'select' ||
      field.type === 'shortcut'
    const valueToUse = hasLocalValue
      ? fieldValue
      : hasResolvedValue && canInlineOverride
      ? resolvedFieldValue
      : field.defaultValue
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
    const overrideCurrentField = () => {
      if (!hasResolvedValue) return
      handleValueChange(resolvedFieldValue)
    }

    if (readOnly) {
      control = (
        <DisplayValue
          value={hasResolvedValue ? resolvedFieldValue : fieldValue ?? field.defaultValue}
          sectionKey={sectionKey}
          path={field.path}
          t={t}
        />
      )
    } else if (field.type === 'detailCollection') {
      control = (
        <DetailCollectionField
          sectionKey={sectionKey}
          field={field}
          value={fieldValue}
          resolvedValue={resolvedFieldValue}
          onChange={(next) => handleValueChange(next)}
          onOpenDetail={(route) => onOpenDetailRoute?.(route)}
          mergedModelServices={mergedModelServices}
          mergedAdapters={mergedAdapters}
          uiSection={uiSection}
          t={t}
        />
      )
    } else if (inheritedOnly && !canInlineOverride) {
      control = renderInheritedReadonlyControl({
        fieldValue: resolvedFieldValue,
        fieldPath: field.path,
        onOverride: overrideCurrentField
      })
    } else if (field.type === 'string') {
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
      const isWorktreeEnvironment = sectionKey === 'conversation' && field.path.join('.') === 'worktreeEnvironment'
      const options: Array<{ value: string; label: ReactNode }> = isDefaultModelService
        ? modelServiceOptions
        : isDefaultModel
        ? modelOptions
        : isDefaultAdapter
        ? adapterOptions
        : isWorktreeEnvironment
        ? worktreeEnvironmentOptions ?? []
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
              : isWorktreeEnvironment
              ? 'config.editor.worktreeEnvironmentPlaceholder'
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

    if (directDetailSections.has(sectionKey) && field.type === 'detailCollection' && field.path.length === 0) {
      return (
        <div key={`${keyPrefix}:${field.path.join('.')}:${field.type}`}>
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
    currentResolvedValue,
    onCurrentValueChange,
    keyPrefix,
    readOnly = false
  }: {
    currentFields: FieldSpec[]
    currentValue: unknown
    currentResolvedValue?: unknown
    onCurrentValueChange: (nextValue: unknown) => void
    keyPrefix: string
    readOnly?: boolean
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
                  {groupFields.map(field =>
                    renderField({
                      field,
                      currentValue,
                      currentResolvedValue,
                      onCurrentValueChange,
                      keyPrefix,
                      readOnly
                    })
                  )}
                </div>
              )
            }
            return (
              <div key={`${keyPrefix}:${groupKey}`} className='config-view__field-list'>
                {groupFields.map(field =>
                  renderField({
                    field,
                    currentValue,
                    currentResolvedValue,
                    onCurrentValueChange,
                    keyPrefix,
                    readOnly
                  })
                )}
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
                    disabled={readOnly}
                    onClick={(_, event) => {
                      event.stopPropagation()
                    }}
                  />
                )}
              </div>
            ),
            children: (
              <div className='config-view__field-list'>
                {group.fields.map(field =>
                  renderField({
                    field,
                    currentValue,
                    currentResolvedValue,
                    onCurrentValueChange,
                    keyPrefix,
                    readOnly
                  })
                )}
              </div>
            )
          }))

          const groupBody = (
            <div className='config-view__subsection-body'>
              {nonCollapseFields.map(field =>
                renderField({
                  field,
                  currentValue,
                  currentResolvedValue,
                  onCurrentValueChange,
                  keyPrefix,
                  readOnly
                })
              )}
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
    resolvedValue,
    route: detailRoute,
    detailContext,
    t
  })

  if (detailMeta != null) {
    const detailCollection = detailMeta.field.detailCollection
    const canOverrideInheritedDetailItem = detailCollection != null &&
      (
        detailCollection.collectionKind !== 'list' ||
        detailCollection.getMergeKey != null
      )
    const writeDetailItem = (nextItem: unknown) => {
      if (detailMeta.field.type !== 'detailCollection' || detailMeta.field.detailCollection == null) return
      const resolvedNextItem = (
          nextItem != null &&
          typeof nextItem === 'object' &&
          !Array.isArray(nextItem)
        )
        ? nextItem as Record<string, unknown>
        : {}

      if (detailMeta.field.detailCollection.collectionKind === 'list') {
        const currentListValue = getValueByPath(value, detailMeta.field.path)
        const currentItems = Array.isArray(currentListValue)
          ? currentListValue.filter((item): item is Record<string, unknown> => (
            item != null &&
            typeof item === 'object' &&
            !Array.isArray(item)
          ))
          : []
        const nextItems = [...currentItems]
        if (detailMeta.localItemIndex == null) {
          nextItems.push(resolvedNextItem)
        } else {
          nextItems[detailMeta.localItemIndex] = resolvedNextItem
        }
        onChange(setValueByPath(value, detailMeta.field.path, nextItems))
        return
      }

      onChange(setValueByPath(value, [...detailMeta.field.path, detailMeta.itemKey], resolvedNextItem))
    }
    const overrideDetailItem = () => {
      if (!canOverrideInheritedDetailItem) return
      writeDetailItem(detailMeta.resolvedItem)
    }
    const detailNotice = detailMeta.itemSource === 'inherited'
      ? (
        <div className='config-view__detail-notice'>
          <div className='config-view__detail-notice-text'>
            {canOverrideInheritedDetailItem
              ? t('config.detail.inheritedReadonly')
              : t('config.detail.inheritedAppendOnly')}
          </div>
          {canOverrideInheritedDetailItem && (
            <Button size='small' type='primary' onClick={overrideDetailItem}>
              {t('config.detail.override')}
            </Button>
          )}
        </div>
      )
      : detailMeta.hasResolvedOverlay
      ? (
        <div className='config-view__detail-notice'>
          <div className='config-view__detail-notice-text'>
            {t('config.detail.partialOverride')}
          </div>
        </div>
      )
      : null

    if (detailMeta.itemSource === 'inherited') {
      if ((detailMeta.field.detailCollection?.itemFields?.length ?? 0) > 0) {
        return (
          <div className='config-view__detail-panel'>
            {detailNotice}
            {renderFieldGroups({
              currentFields: detailMeta.field.detailCollection!.itemFields!,
              currentValue: undefined,
              currentResolvedValue: detailMeta.resolvedItem,
              onCurrentValueChange: () => undefined,
              keyPrefix: `detail:${detailMeta.field.path.join('.')}:${detailMeta.itemKey}`,
              readOnly: true
            })}
          </div>
        )
      }

      return (
        <div className='config-view__detail-panel'>
          {detailNotice}
          <DisplayValue value={detailMeta.resolvedItem} sectionKey={sectionKey} path={detailMeta.field.path} t={t} />
        </div>
      )
    }

    if (detailMeta.field.detailCollection?.detailKind === 'recommendedModels') {
      return (
        <div className='config-view__detail-panel'>
          {detailNotice}
          <RecommendedModelsItemEditor
            value={detailMeta.item}
            onChange={writeDetailItem}
            mergedModelServices={mergedModelServices}
            t={t}
          />
        </div>
      )
    }

    if (detailMeta.field.detailCollection?.detailKind === 'mcpServer') {
      return (
        <div className='config-view__detail-panel'>
          {detailNotice}
          <McpServerItemEditor
            value={detailMeta.item}
            onChange={writeDetailItem}
            t={t}
          />
        </div>
      )
    }

    if (uiSection?.kind === 'recordMap' && detailMeta.field.path.length === 0) {
      const { itemSchema, isKnownEntry } = resolveConfigUiRecordEntry({
        schema: uiSection.recordMap,
        entryKey: detailMeta.itemKey,
        entryValue: detailMeta.item
      })
      const shouldRenderJsonFallback = !isKnownEntry && uiSection.recordMap.unknownEditor === 'json'
      const discriminatorField = uiSection.recordMap.discriminatorField ?? 'type'

      if (shouldRenderJsonFallback) {
        return (
          <div className='config-view__detail-panel'>
            {detailNotice}
            <ComplexTextEditor
              value={detailMeta.item}
              onChange={(next) => writeDetailItem((next ?? {}) as Record<string, unknown>)}
            />
          </div>
        )
      }

      if (itemSchema != null) {
        return (
          <div className='config-view__detail-panel'>
            {detailNotice}
            <SchemaObjectEditor
              value={detailMeta.item}
              schema={itemSchema}
              onChange={writeDetailItem}
              t={t}
              hideFieldPath={isKnownEntry && uiSection.recordMap.mode === 'discriminated'
                ? [discriminatorField]
                : undefined}
            />
          </div>
        )
      }
    }

    if ((detailMeta.field.detailCollection?.itemFields?.length ?? 0) > 0) {
      return (
        <div className='config-view__detail-panel'>
          {detailNotice}
          {renderFieldGroups({
            currentFields: detailMeta.field.detailCollection!.itemFields!,
            currentValue: detailMeta.item,
            currentResolvedValue: detailMeta.resolvedItem,
            onCurrentValueChange: writeDetailItem,
            keyPrefix: `detail:${detailMeta.field.path.join('.')}:${detailMeta.itemKey}`
          })}
        </div>
      )
    }

    return (
      <div className='config-view__detail-panel'>
        {detailNotice}
        <Empty description={t('common.noData')} image={null} />
      </div>
    )
  }

  return renderFieldGroups({
    currentFields: fields,
    currentValue: value,
    currentResolvedValue: resolvedValue,
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
