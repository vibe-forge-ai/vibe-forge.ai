import './record-editors/RecordEditors.scss'

import { Button, Switch, Tooltip } from 'antd'

import type { ConfigDetailRoute } from './configDetail'
import { toDetailCollectionEntries } from './configDetail'
import { DetailCollectionFieldActions } from './DetailCollectionFieldActions'
import type { FieldSpec } from './configSchema'
import { getFieldLabel, getValueByPath, setValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'

export const DetailCollectionField = ({
  sectionKey,
  field,
  value,
  onChange,
  onOpenDetail,
  mergedModelServices,
  mergedAdapters,
  t
}: {
  sectionKey: string
  field: FieldSpec
  value: unknown
  onChange: (nextValue: unknown) => void
  onOpenDetail: (route: ConfigDetailRoute) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  t: TranslationFn
}) => {
  const detailCollection = field.detailCollection
  if (detailCollection == null) return null

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

  return (
    <div className='config-view__detail-list'>
      {items.map(({ item, key, index }) => {
        const title = detailCollection.getItemTitle(item, key, index, detailContext)
        const subtitle = detailCollection.getItemSubtitle?.(item, key, index, detailContext)
        const description = detailCollection.getItemDescription?.(item, key, index, detailContext)
        return (
          <div key={`${field.path.join('.')}:${key}:${title}`} className='config-view__record-card'>
            <div className='config-view__detail-list-row'>
              <button type='button' className='config-view__detail-list-main' onClick={() => openDetail(key)}>
                <div className='config-view__record-heading'>
                  <div>{title}</div>
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
              {renderSummaryControls(item, key, title)}
              {isListCollection && (
                <DetailCollectionFieldActions
                  index={index}
                  itemCount={items.length}
                  onMove={direction => moveItem(index, direction)}
                  onRemove={() => removeItem(index)}
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
    </div>
  )
}
