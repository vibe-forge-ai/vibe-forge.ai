import './ConfigDisplayValue.scss'

import { Empty } from 'antd'

import { FieldRow } from './ConfigFieldRow'
import { getFieldDescription, getFieldLabel, getTypeIcon, getValueType, isEmptyValue } from './configUtils'
import type { TranslationFn } from './configUtils'

export const DisplayValue = ({
  value,
  sectionKey,
  path = [],
  t
}: {
  value: unknown
  sectionKey: string
  path?: string[]
  t: TranslationFn
}) => {
  if (isEmptyValue(value)) {
    return <Empty description={t('common.noData')} image={null} />
  }

  if (Array.isArray(value)) {
    const hasObject = value.some(item => item != null && typeof item === 'object')
    if (hasObject) {
      return <span className='config-view__pill'>{t('config.editor.complexValue')}</span>
    }
    return (
      <div className='config-view__display-pill'>
        {value.map((item, index) => (
          <span key={`${index}-${String(item)}`} className='config-view__pill'>
            {String(item)}
          </span>
        ))}
      </div>
    )
  }

  if (value != null && typeof value === 'object') {
    return (
      <div className='config-view__field-list'>
        {Object.entries(value).map(([key, itemValue]) => {
          const label = getFieldLabel(t, sectionKey, [...path, key], key)
          const description = getFieldDescription(t, sectionKey, [...path, key])
          return (
            <FieldRow
              key={key}
              title={label}
              description={description}
              icon={getTypeIcon(getValueType(itemValue))}
            >
              <DisplayValue value={itemValue} sectionKey={sectionKey} path={[...path, key]} t={t} />
            </FieldRow>
          )
        })}
      </div>
    )
  }

  return <span className='config-view__pill'>{String(value)}</span>
}
