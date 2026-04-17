import './record-editors/RecordEditors.scss'

import { Button, Popconfirm, Tooltip } from 'antd'

import type { ConfigDetailRoute } from './configDetail'
import { toDetailListItems } from './configDetail'
import type { FieldSpec } from './configSchema'
import { getFieldLabel } from './configUtils'
import type { TranslationFn } from './configUtils'

export const DetailListField = ({
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
  onChange: (nextValue: unknown[]) => void
  onOpenDetail: (route: ConfigDetailRoute) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  t: TranslationFn
}) => {
  const detailList = field.detailList
  if (detailList == null) return null

  const items = toDetailListItems(value)
  const detailContext = {
    mergedModelServices,
    mergedAdapters,
    t
  }
  const fieldLabel = field.labelKey != null
    ? t(field.labelKey)
    : getFieldLabel(t, sectionKey, field.path, field.path.at(-1) ?? sectionKey)

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const next = items.slice()
    const [current] = next.splice(index, 1)
    if (current == null) return
    next.splice(targetIndex, 0, current)
    onChange(next)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  const openDetail = (itemIndex: number) => {
    onOpenDetail({
      kind: 'detailListItem',
      fieldPath: field.path,
      itemIndex
    })
  }

  return (
    <div className='config-view__detail-list'>
      {items.map((item, index) => {
        const title = detailList.getItemTitle(item, index, detailContext)
        const subtitle = detailList.getItemSubtitle?.(item, index, detailContext)
        const description = detailList.getItemDescription?.(item, index, detailContext)
        return (
          <div key={`${field.path.join('.')}:${index}:${title}`} className='config-view__record-card'>
            <div className='config-view__detail-list-row'>
              <button type='button' className='config-view__detail-list-main' onClick={() => openDetail(index)}>
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
              <div className='config-view__record-actions'>
                <Tooltip title={t('config.editor.moveUp')}>
                  <Button
                    size='small'
                    type='text'
                    className='config-view__icon-button config-view__icon-button--compact'
                    aria-label={t('config.editor.moveUp')}
                    icon={<span className='material-symbols-rounded'>keyboard_arrow_up</span>}
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                  />
                </Tooltip>
                <Tooltip title={t('config.editor.moveDown')}>
                  <Button
                    size='small'
                    type='text'
                    className='config-view__icon-button config-view__icon-button--compact'
                    aria-label={t('config.editor.moveDown')}
                    icon={<span className='material-symbols-rounded'>keyboard_arrow_down</span>}
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  />
                </Tooltip>
                <Popconfirm
                  title={t('config.editor.removeItemConfirmTitle')}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  onConfirm={() => removeItem(index)}
                >
                  <Tooltip title={t('config.editor.remove')}>
                    <Button
                      size='small'
                      type='text'
                      danger
                      className='config-view__icon-button config-view__icon-button--compact'
                      aria-label={t('config.editor.remove')}
                      icon={<span className='material-symbols-rounded'>delete</span>}
                    />
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          </div>
        )
      })}
      {items.length === 0 && (
        <div className='config-view__detail-list-empty'>
          <div className='config-view__detail-list-empty-title'>{fieldLabel}</div>
          <div className='config-view__detail-list-empty-desc'>{t('common.noData')}</div>
        </div>
      )}
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
                ...items,
                detailList.createItem()
              ]
              onChange(next)
              openDetail(next.length - 1)
            }}
          />
        </Tooltip>
      </div>
    </div>
  )
}
