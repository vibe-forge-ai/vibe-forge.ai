import './ConfigEditors.scss'

import { App, Button, Input, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationFn } from './configUtils'

export const ComplexTextEditor = ({
  value,
  onChange
}: {
  value: unknown
  onChange?: (nextValue: unknown) => void
}) => {
  const { message } = App.useApp()
  const { t } = useTranslation()
  const [textValue, setTextValue] = useState(() => JSON.stringify(value ?? {}, null, 2))

  useEffect(() => {
    setTextValue(JSON.stringify(value ?? {}, null, 2))
  }, [value])

  return (
    <Input.TextArea
      className='config-view__complex-editor'
      value={textValue}
      onChange={(event) => {
        setTextValue(event.target.value)
      }}
      onBlur={() => {
        try {
          const parsed = JSON.parse(textValue) as unknown
          onChange?.(parsed)
          setTextValue(JSON.stringify(parsed ?? {}, null, 2))
        } catch {
          void message.error(t('config.invalidJson'))
          setTextValue(JSON.stringify(value ?? {}, null, 2))
        }
      }}
      placeholder={t('config.editor.complexPlaceholder')}
      autoSize={{ minRows: 6 }}
    />
  )
}

export const StringArrayEditor = ({
  value,
  onChange,
  t
}: {
  value: string[]
  onChange: (nextValue: string[]) => void
  t: TranslationFn
}) => (
  <div className='config-view__array-list'>
    {value.map((item, index) => (
      <div key={`${index}-${item}`} className='config-view__array-item'>
        <Input
          value={item}
          placeholder={t('config.editor.itemPlaceholder')}
          onChange={(event) => {
            const updated = value.slice()
            updated[index] = event.target.value
            onChange(updated)
          }}
        />
        <Tooltip title={t('config.editor.remove')}>
          <Button
            size='small'
            type='text'
            danger
            className='config-view__icon-button config-view__icon-button--compact'
            aria-label={t('config.editor.remove')}
            icon={<span className='material-symbols-rounded'>delete</span>}
            onClick={() => {
              const updated = value.slice()
              updated.splice(index, 1)
              onChange(updated)
            }}
          />
        </Tooltip>
      </div>
    ))}
    <Tooltip title={t('config.editor.addItem')}>
      <Button
        size='small'
        type='primary'
        className='config-view__icon-button config-view__icon-button--full'
        aria-label={t('config.editor.addItem')}
        icon={<span className='material-symbols-rounded'>add</span>}
        onClick={() => {
          onChange([...value, ''])
        }}
      />
    </Tooltip>
  </div>
)
