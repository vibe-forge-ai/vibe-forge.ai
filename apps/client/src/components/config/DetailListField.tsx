/* eslint-disable max-lines -- detail collection list/add/remove flow stays in one renderer for consistency */
import './record-editors/RecordEditors.scss'

import { Button, Input, Select, Switch, Tooltip } from 'antd'
import { useMemo, useState } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'
import { getAdapterDisplay } from '#~/resources/adapters'

import { DetailCollectionFieldActions } from './DetailCollectionFieldActions'
import type { ConfigDetailRoute } from './configDetail'
import { toDetailCollectionEntries } from './configDetail'
import type { FieldSpec } from './configSchema'
import { getFieldLabel, getValueByPath, setValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'
import { buildConfigUiObjectDefaultValue } from './record-editors/schemaRecordUtils'

const normalizeConfigText = (value: unknown) => (
  typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : ''
)

const formatAdapterKeyTitle = (adapterKey: string) => (
  adapterKey
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
)

const resolveAdapterListTitle = (adapterKey: string) => {
  const adapterDisplay = getAdapterDisplay(adapterKey)
  const displayTitle = normalizeConfigText(adapterDisplay.title)
  return displayTitle !== '' && displayTitle !== adapterKey
    ? displayTitle
    : formatAdapterKeyTitle(adapterKey)
}

const resolveAdapterListSubtitle = ({
  item,
  fallbackSubtitle,
  t
}: {
  item: Record<string, unknown>
  fallbackSubtitle?: string
  t: TranslationFn
}) => {
  const summaryParts: string[] = []
  const defaultModel = normalizeConfigText(item.defaultModel)
  const defaultAccount = normalizeConfigText(item.defaultAccount)

  if (defaultModel !== '') {
    summaryParts.push(`${t('config.fields.adapters.defaultModel.label')}: ${defaultModel}`)
  }

  if (defaultAccount !== '') {
    summaryParts.push(`${t('config.fields.adapters.defaultAccount.label')}: ${defaultAccount}`)
  }

  if (summaryParts.length > 0) return summaryParts.join(' · ')
  return fallbackSubtitle
}

export const DetailCollectionField = ({
  sectionKey,
  field,
  value,
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
    value
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

  const updateRecordEntry = (itemKey: string, nextItem: Record<string, unknown>) => {
    onChange(setValueByPath(value, [itemKey], nextItem))
  }

  const updateListItems = (nextItems: Array<Record<string, unknown>>) => {
    onChange(nextItems)
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    if (!isListCollection) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const next = items.map(item => item.item)
    const [current] = next.splice(index, 1)
    if (current == null) return
    next.splice(targetIndex, 0, current)
    updateListItems(next)
  }

  const removeItem = (index: number) => {
    if (!isListCollection) return
    updateListItems(items.filter((_, itemIndex) => itemIndex !== index).map(item => item.item))
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

  const renderSummaryControls = (item: Record<string, unknown>, itemKey: string, title: string) => {
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
                  const nextItems = items.map(entry => (
                    entry.key === itemKey ? nextItem : entry.item
                  ))
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
      {items.map(({ item, key, index }) => {
        const title = detailCollection.getItemTitle(item, key, index, detailContext)
        const subtitle = detailCollection.getItemSubtitle?.(item, key, index, detailContext)
        const description = detailCollection.getItemDescription?.(item, key, index, detailContext)
        const adapterDisplay = sectionKey === 'adapters' ? getAdapterDisplay(key) : undefined
        const displayTitle = sectionKey === 'adapters' ? resolveAdapterListTitle(key) : title
        const displaySubtitle = sectionKey === 'adapters'
          ? resolveAdapterListSubtitle({ item, fallbackSubtitle: subtitle, t })
          : subtitle
        return (
          <div key={`${field.path.join('.')}:${key}:${title}`} className='config-view__record-card'>
            <div className='config-view__detail-list-row'>
              <button type='button' className='config-view__detail-list-main' onClick={() => openDetail(key)}>
                <div className={`config-view__record-heading${adapterDisplay?.icon != null ? ' has-adapter-icon' : ''}`}>
                  {adapterDisplay != null && (
                    <div className='config-view__adapter-icon-wrap' aria-hidden='true'>
                      {adapterDisplay.icon != null
                        ? (
                          <img
                            className='config-view__adapter-icon'
                            src={adapterDisplay.icon}
                            alt=''
                          />
                        )
                        : (
                          <span className='config-view__adapter-icon-fallback material-symbols-rounded'>
                            deployed_code
                          </span>
                        )}
                    </div>
                  )}
                  <div className='config-view__record-heading-text'>
                    <div>{displayTitle}</div>
                    {displaySubtitle != null && displaySubtitle !== '' && (
                      <div className='config-view__record-subtitle'>
                        {displaySubtitle}
                      </div>
                    )}
                    {description != null && description !== '' && (
                      <div className='config-view__record-desc'>{description}</div>
                    )}
                  </div>
                </div>
              </button>
              {renderSummaryControls(item, key, displayTitle)}
              {(isListCollection || isRecordMapCollection) && (
                <DetailCollectionFieldActions
                  index={index}
                  itemCount={items.length}
                  onMove={isListCollection ? (direction) => moveItem(index, direction) : undefined}
                  onRemove={() => {
                    if (isListCollection) {
                      removeItem(index)
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
                const next = [
                  ...items.map(item => item.item),
                  detailCollection.createItem()
                ]
                updateListItems(next)
                openDetail(String(next.length - 1))
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
