import { Form, Input, Select } from 'antd'
import type { FormInstance, InputProps } from 'antd'
import { useTranslation } from 'react-i18next'

export interface ServerConnectionFormValues {
  serverScheme: ServerScheme
  serverUrl: string
}

export type ServerScheme = 'http' | 'https'

export const DEFAULT_SERVER_SCHEME: ServerScheme = 'http'
export const DEFAULT_SERVER_HOST = 'localhost:8787'

const SERVER_SCHEME_OPTIONS = [
  { label: 'http://', value: 'http' },
  { label: 'https://', value: 'https' }
] satisfies Array<{ label: string; value: ServerScheme }>

const SERVER_SCHEME_SUFFIX_ICON = (
  <span className='material-symbols-rounded server-connection-gate__scheme-chevron'>expand_more</span>
)

const splitServerUrlInput = (value: string) => {
  const trimmed = value.trim()
  const match = /^(https?):\/\/(.+)$/i.exec(trimmed)
  if (match == null) {
    return {
      serverScheme: undefined,
      serverHost: trimmed
    }
  }
  return {
    serverScheme: match[1].toLowerCase() as ServerScheme,
    serverHost: match[2].trim()
  }
}

export const buildServerUrl = (values: ServerConnectionFormValues) => {
  const parsed = splitServerUrlInput(values.serverUrl)
  return `${parsed.serverScheme ?? values.serverScheme}://${parsed.serverHost}`
}

export const normalizeServerUrlField = (form: FormInstance<ServerConnectionFormValues>) => {
  const currentValue = form.getFieldValue('serverUrl')
  if (typeof currentValue !== 'string') return
  const parsed = splitServerUrlInput(currentValue)
  if (parsed.serverScheme == null) return
  form.setFieldsValue({
    serverScheme: parsed.serverScheme,
    serverUrl: parsed.serverHost
  })
}

interface ServerConnectionUrlInputProps extends Omit<InputProps, 'form'> {
  form: FormInstance<ServerConnectionFormValues>
}

export function ServerConnectionUrlInput({ form, onBlur, ...inputProps }: ServerConnectionUrlInputProps) {
  const { t } = useTranslation()

  return (
    <Input
      {...inputProps}
      autoComplete='url'
      addonBefore={
        <Form.Item name='serverScheme' noStyle>
          <Select
            aria-label={t('serverConnection.serverScheme')}
            className='server-connection-gate__scheme-select'
            options={SERVER_SCHEME_OPTIONS}
            popupMatchSelectWidth={false}
            suffixIcon={SERVER_SCHEME_SUFFIX_ICON}
          />
        </Form.Item>
      }
      onBlur={(event) => {
        onBlur?.(event)
        normalizeServerUrlField(form)
      }}
      size='large'
      placeholder={t('serverConnection.serverUrlPlaceholder')}
    />
  )
}
