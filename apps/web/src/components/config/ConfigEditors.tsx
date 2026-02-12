import './ConfigEditors.scss'

import { App, Button, Input } from 'antd'
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
        <Button
          size='small'
          onClick={() => {
            const updated = value.slice()
            updated.splice(index, 1)
            onChange(updated)
          }}
        >
          {t('config.editor.remove')}
        </Button>
      </div>
    ))}
    <Button
      size='small'
      onClick={() => {
        onChange([...value, ''])
      }}
    >
      {t('config.editor.addItem')}
    </Button>
  </div>
)
