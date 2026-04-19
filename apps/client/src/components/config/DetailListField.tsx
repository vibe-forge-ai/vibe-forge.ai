/* eslint-disable max-lines -- detail collection list/add/remove flow stays in one renderer for consistency */
import './record-editors/RecordEditors.scss'

import { Button, Input, Select, Switch, Tooltip } from 'antd'
import { useMemo, useState } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'

import { DetailCollectionFieldActions } from './DetailCollectionFieldActions'
import type { ConfigDetailRoute } from './configDetail'
import { toDetailCollectionEntries } from './configDetail'
import type { FieldSpec } from './configSchema'
import { getFieldLabel, getValueByPath, setValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'
import { buildConfigUiObjectDefaultValue } from './record-editors/schemaRecordUtils'

export const DetailCollectionField = ({
  sectionKey,
  field,
  value,
  resolvedValue,
  onChange,
  onOpenDetail,
  mergedModelServices,
  mergedAdapters,
  uiSection,
  t
}: {
  sectionKey: string
  field: FieldSpec
  value: unknown
  resolvedValue?: unknown
  onChange: (nextValue: unknown) => void
  onOpenDetail: (route: ConfigDetailRoute) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  uiSection?: ConfigUiSection
  t: TranslationFn
}) => {
  const detailCollection = field.detailCollection
  if (detailCollection == null) return null
  const [newRecordKey, setNewRecordKey] = useState('')
  const [newRecordKind, setNewRecordKind] = useState(
    uiSection?.kind === 'recordMap' ? (uiSection.recordMap.entryKinds?.[0]?.key ?? '') : ''
  )

  const items = toDetailCollectionEntries({
    field,
    value,
    resolvedValue
  })
  const detailContext = {
    mergedModelServices,
    mergedAdapters,
    t
  }
  const fieldLabel = field.labelKey != null
    ? t(field.labelKey)
    : getFieldLabel(t, sectionKey, field.path, field.path.at(-1) ?? sectionKey)
  const isListCollection = detailCollection.collectionKind === 'list'
  const isRecordMapCollection = detailCollection.collectionKind === 'recordMap'
  const canSelectKind = isRecordMapCollection && uiSection?.kind === 'recordMap' &&
    uiSection.recordMap.mode === 'discriminated'
  const keyPlaceholder = detailCollection.collectionKind === 'recordMap'
    ? (
      detailCollection.keyPlaceholderKey != null
        ? t(detailCollection.keyPlaceholderKey)
        : t('config.editor.fieldKey')
    )
    : ''
  const kindOptions = useMemo(() => (
    uiSection?.kind === 'recordMap'
      ? (uiSection.recordMap.entryKinds ?? []).map(item => ({
        value: item.key,
        label: item.label ?? item.key
      }))
      : []
  ), [uiSection])
  const localListItems = isListCollection && Array.isArray(value)
    ? value.filter(item => item != null && typeof item === 'object' && !Array.isArray(item)) as Array<
      Record<string, unknown>
    >
    : []

  const updateRecordEntry = (itemKey: string, nextItem: Record<string, unknown>) => {
    onChange(setValueByPath(value, [itemKey], nextItem))
  }

  const updateListItems = (nextItems: Array<Record<string, unknown>>) => {
    onChange(nextItems)
  }

  const moveItem = (localIndex: number, direction: -1 | 1) => {
    if (!isListCollection) return
    const targetIndex = localIndex + direction
    if (targetIndex < 0 || targetIndex >= localListItems.length) return
    const next = [...localListItems]
    const [current] = next.splice(localIndex, 1)
    if (current == null) return
    next.splice(targetIndex, 0, current)
    updateListItems(next)
  }

  const removeItem = (localIndex: number) => {
    if (!isListCollection) return
    updateListItems(localListItems.filter((_, itemIndex) => itemIndex !== localIndex))
  }

  const removeRecordItem = (itemKey: string) => {
    if (!isRecordMapCollection) return
    const currentValue = (value != null && typeof value === 'object' && !Array.isArray(value))
      ? { ...(value as Record<string, unknown>) }
      : {}
    delete currentValue[itemKey]
    onChange(currentValue)
  }

  const openDetail = (itemKey: string) => {
    onOpenDetail({
      kind: 'detailCollectionItem',
      fieldPath: field.path,
      itemKey
    })
  }

  const renderSummaryControls = ({
    item,
    itemKey,
    title,
    localIndex,
    source
  }: {
    item: Record<string, unknown>
    itemKey: string
    title: string
    localIndex?: number
    source: 'local' | 'inherited'
  }) => {
    if (source !== 'local') return null
    if ((detailCollection.summaryControls?.length ?? 0) === 0) return null

    return (
      <div
        className='config-view__detail-summary-controls'
        onClick={event => event.stopPropagation()}
      >
        {detailCollection.summaryControls!.map((control) => {
          if (control.kind !== 'boolean') return null
          const checkedValue = control.checkedValue ?? true
          const currentValue = Boolean(getValueByPath(item, control.path))
          const checked = currentValue === checkedValue
          const label = control.labelKey != null ? t(control.labelKey) : title

          return (
            <Switch
              key={`${itemKey}:${control.path.join('.')}`}
              size='small'
              checked={checked}
              aria-label={label}
              onChange={(nextChecked) => {
                const nextItem = setValueByPath(
                  item,
                  control.path,
                  nextChecked ? checkedValue : !checkedValue
                ) as Record<string, unknown>
                if (isListCollection) {
                  if (localIndex == null) return
                  const nextItems = [...localListItems]
                  nextItems[localIndex] = nextItem
                  updateListItems(nextItems)
                  return
                }
                updateRecordEntry(itemKey, nextItem)
              }}
            />
          )
        })}
      </div>
    )
  }

  const addRecordItem = () => {
    if (!isRecordMapCollection) return
    const itemKey = newRecordKey.trim()
    if (itemKey === '' || items.some(item => item.key === itemKey)) return

    let nextItem: Record<string, unknown>
    if (uiSection?.kind === 'recordMap') {
      const nextSchema = uiSection.recordMap.mode === 'discriminated'
        ? (uiSection.recordMap.schemas[newRecordKind] ?? uiSection.recordMap.unknownSchema)
        : (uiSection.recordMap.schemas[itemKey] ?? uiSection.recordMap.unknownSchema)
      nextItem = buildConfigUiObjectDefaultValue(nextSchema)
      if (uiSection.recordMap.mode === 'discriminated') {
        const discriminatorField = uiSection.recordMap.discriminatorField ?? 'type'
        nextItem = setValueByPath(nextItem, [discriminatorField], newRecordKind) as Record<string, unknown>
      }
    } else {
      nextItem = detailCollection.createItem?.(itemKey, newRecordKind) ?? {}
    }

    updateRecordEntry(itemKey, nextItem)
    setNewRecordKey('')
    openDetail(itemKey)
  }

  return (
    <div className='config-view__detail-list'>
      {items.map(({ item, key, index, localIndex, source, hasResolvedOverlay }) => {
        const title = detailCollection.getItemTitle(item, key, index, detailContext)
        const subtitle = detailCollection.getItemSubtitle?.(item, key, index, detailContext)
        const description = detailCollection.getItemDescription?.(item, key, index, detailContext)
        return (
          <div
            key={`${field.path.join('.')}:${key}:${title}`}
            className={`config-view__record-card${source === 'inherited' ? ' config-view__record-card--readonly' : ''}`}
          >
            <div className='config-view__detail-list-row'>
              <button type='button' className='config-view__detail-list-main' onClick={() => openDetail(key)}>
                <div className='config-view__record-heading'>
                  <div className='config-view__detail-list-title'>
                    <span>{title}</span>
                    {(source === 'inherited' || hasResolvedOverlay) && (
                      <span
                        className={`config-view__detail-badge${
                          source === 'inherited'
                            ? ' config-view__detail-badge--readonly'
                            : ' config-view__detail-badge--override'
                        }`}
                      >
                        {source === 'inherited'
                          ? t('config.detail.inheritedBadge')
                          : t('config.detail.overrideBadge')}
                      </span>
                    )}
                  </div>
                  {subtitle != null && subtitle !== '' && (
                    <div className='config-view__record-subtitle'>
                      {subtitle}
                    </div>
                  )}
                  {description != null && description !== '' && (
                    <div className='config-view__record-desc'>{description}</div>
                  )}
                </div>
              </button>
              {renderSummaryControls({ item, itemKey: key, title, localIndex, source })}
              {(isListCollection || isRecordMapCollection) && source === 'local' && (
                <DetailCollectionFieldActions
                  index={localIndex ?? 0}
                  itemCount={isListCollection
                    ? localListItems.length
                    : items.filter(entry => entry.source === 'local').length}
                  onMove={isListCollection
                    ? (direction) => {
                      if (localIndex == null) return
                      moveItem(localIndex, direction)
                    }
                    : undefined}
                  onRemove={() => {
                    if (isListCollection) {
                      if (localIndex == null) return
                      removeItem(localIndex)
                      return
                    }
                    removeRecordItem(key)
                  }}
                  t={t}
                />
              )}
            </div>
          </div>
        )
      })}
      {isListCollection && items.length === 0 && (
        <div className='config-view__detail-list-empty'>
          <div className='config-view__detail-list-empty-title'>{fieldLabel}</div>
          <div className='config-view__detail-list-empty-desc'>{t('common.noData')}</div>
        </div>
      )}
      {isListCollection && (
        <div className='config-view__record-add'>
          <Tooltip title={t('config.editor.addItem')}>
            <Button
              size='small'
              type='primary'
              className='config-view__icon-button config-view__icon-button--full'
              aria-label={t('config.editor.addItem')}
              icon={<span className='material-symbols-rounded'>add</span>}
              onClick={() => {
                const next = [...localListItems, detailCollection.createItem()]
                updateListItems(next)
                const nextEntries = toDetailCollectionEntries({
                  field,
                  value: next,
                  resolvedValue
                })
                const nextEntry = nextEntries.find(entry => entry.localIndex === next.length - 1)
                openDetail(nextEntry?.key ?? String(next.length - 1))
              }}
            />
          </Tooltip>
        </div>
      )}
      {isRecordMapCollection && (
        <div className='config-view__record-add'>
          <div className='config-view__record-add-inputs'>
            <Input
              value={newRecordKey}
              placeholder={keyPlaceholder}
              onChange={(event) => setNewRecordKey(event.target.value)}
            />
            {canSelectKind && (
              <Select
                value={newRecordKind}
                options={kindOptions}
                onChange={(nextValue) => setNewRecordKind(nextValue)}
              />
            )}
            <Tooltip title={t('common.confirm')}>
              <Button
                size='small'
                type='primary'
                className='config-view__icon-button'
                aria-label={t('common.confirm')}
                icon={<span className='material-symbols-rounded'>check</span>}
                disabled={newRecordKey.trim() === '' ||
                  items.some(item => item.key === newRecordKey.trim()) ||
                  (canSelectKind && newRecordKind.trim() === '')}
                onClick={addRecordItem}
              />
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
