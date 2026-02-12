import './ConfigView.scss'

import { App, Button, Empty, Input, InputNumber, Radio, Select, Space, Spin, Switch, Tabs } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { getConfig, updateConfig } from '../api'

interface ConfigSection {
  general?: unknown
  conversation?: unknown
  modelServices?: unknown
  adapters?: unknown
  plugins?: unknown
  mcp?: unknown
  shortcuts?: unknown
}

interface AboutInfo {
  version?: string
  lastReleaseAt?: string
  urls?: {
    repo?: string
    docs?: string
    contact?: string
    issues?: string
    releases?: string
  }
}

interface ConfigResponse {
  sources?: {
    project?: ConfigSection
    user?: ConfigSection
    merged?: ConfigSection
  }
  meta?: {
    workspaceFolder?: string
    configPresent?: {
      project?: boolean
      user?: boolean
    }
    experiments?: unknown
    about?: AboutInfo
  }
}

type SourceKey = 'project' | 'user'

const isEmptyValue = (value: unknown) => {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

type EditorValueType = 'string' | 'number' | 'boolean' | 'object' | 'array'

type FieldValueType = 'string' | 'number' | 'boolean' | 'string[]' | 'select' | 'json' | 'multiline' | 'record'

type RecordKind = 'json' | 'modelServices' | 'mcpServers' | 'boolean' | 'keyValue'

interface FieldOption {
  value: string
  label: string
}

interface FieldSpec {
  path: string[]
  type: FieldValueType
  defaultValue: unknown
  options?: FieldOption[]
  placeholderKey?: string
  labelKey?: string
  descriptionKey?: string
  group?: 'base' | 'items'
  recordKind?: RecordKind
  sensitive?: boolean
}

const cloneValue = (value: unknown) => {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value)) as unknown
}

const getValueType = (value: unknown): EditorValueType => {
  if (Array.isArray(value)) return 'array'
  if (value != null && typeof value === 'object') return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

const getTypeIcon = (valueType: EditorValueType) => {
  if (valueType === 'string') return 'text_fields'
  if (valueType === 'number') return 'numbers'
  if (valueType === 'boolean') return 'toggle_on'
  if (valueType === 'array') return 'view_list'
  return 'account_tree'
}

const getFieldLabel = (
  t: (key: string, options?: { defaultValue?: string }) => string,
  sectionKey: string,
  path: string[],
  fallback: string
) => {
  if (path.length === 0) return fallback
  const key = `config.fields.${sectionKey}.${path.join('.')}.label`
  return t(key, { defaultValue: fallback })
}

const getFieldDescription = (
  t: (key: string, options?: { defaultValue?: string }) => string,
  sectionKey: string,
  path: string[]
) => {
  if (path.length === 0) return ''
  const key = `config.fields.${sectionKey}.${path.join('.')}.desc`
  return t(key, { defaultValue: '' })
}

const isSensitiveKey = (key: string) => /key|token|secret|password/i.test(key)

const getValueByPath = (value: unknown, path: string[]) => {
  if (path.length === 0) return value
  let current = value
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const setValueByPath = (value: unknown, path: string[], nextValue: unknown) => {
  if (path.length === 0) return nextValue
  const root = (value != null && typeof value === 'object' && !Array.isArray(value))
    ? { ...(value as Record<string, unknown>) }
    : {}
  let current: Record<string, unknown> = root
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const existing = current[key]
    const next = (existing != null && typeof existing === 'object' && !Array.isArray(existing))
      ? { ...(existing as Record<string, unknown>) }
      : {}
    current[key] = next
    current = next
  }
  current[path[path.length - 1]] = nextValue
  return root
}

const configSchema: Record<string, FieldSpec[]> = {
  general: [
    { path: ['baseDir'], type: 'string', defaultValue: '' },
    { path: ['defaultAdapter'], type: 'string', defaultValue: '' },
    { path: ['defaultModelService'], type: 'select', defaultValue: '' },
    { path: ['defaultModel'], type: 'select', defaultValue: '' },
    { path: ['announcements'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'allow'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'deny'], type: 'string[]', defaultValue: [] },
    { path: ['permissions', 'ask'], type: 'string[]', defaultValue: [] },
    { path: ['env'], type: 'record', recordKind: 'keyValue', defaultValue: {} }
  ],
  conversation: [
    {
      path: ['style'],
      type: 'select',
      defaultValue: 'friendly',
      options: [
        { value: 'friendly', label: 'config.options.conversation.friendly' },
        { value: 'programmatic', label: 'config.options.conversation.programmatic' }
      ]
    },
    { path: ['customInstructions'], type: 'multiline', defaultValue: '' }
  ],
  modelServices: [
    {
      path: [],
      type: 'record',
      recordKind: 'modelServices',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.modelServices.items.label',
      descriptionKey: 'config.fields.modelServices.items.desc'
    }
  ],
  adapters: [
    {
      path: [],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.adapters.items.label',
      descriptionKey: 'config.fields.adapters.items.desc'
    }
  ],
  plugins: [
    {
      path: ['plugins'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.plugins.items.label',
      descriptionKey: 'config.fields.plugins.items.desc'
    },
    {
      path: ['enabledPlugins'],
      type: 'record',
      recordKind: 'boolean',
      defaultValue: {},
      group: 'base',
      labelKey: 'config.fields.plugins.enabled.label',
      descriptionKey: 'config.fields.plugins.enabled.desc'
    },
    {
      path: ['extraKnownMarketplaces'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'base',
      labelKey: 'config.fields.plugins.marketplaces.label',
      descriptionKey: 'config.fields.plugins.marketplaces.desc'
    }
  ],
  mcp: [
    { path: ['defaultIncludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base' },
    { path: ['defaultExcludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base' },
    { path: ['noDefaultVibeForgeMcpServer'], type: 'boolean', defaultValue: false, group: 'base' },
    {
      path: ['mcpServers'],
      type: 'record',
      recordKind: 'mcpServers',
      defaultValue: {},
      group: 'items',
      labelKey: 'config.fields.mcp.items.label',
      descriptionKey: 'config.fields.mcp.items.desc'
    }
  ],
  shortcuts: [
    { path: ['newSession'], type: 'string', defaultValue: '' },
    { path: ['openConfig'], type: 'string', defaultValue: '' }
  ]
}

const FieldRow = ({
  title,
  description,
  icon,
  layout = 'inline',
  children
}: {
  title: string
  description?: string
  icon?: string
  layout?: 'inline' | 'stacked'
  children: ReactNode
}) => (
  <div className={`config-view__field-row${layout === 'stacked' ? ' config-view__field-row--stacked' : ''}`}>
    <div className='config-view__field-meta'>
      {icon != null && (
        <span className='material-symbols-rounded config-view__field-icon'>
          {icon}
        </span>
      )}
      <div className='config-view__field-text'>
        <div className='config-view__field-title'>{title}</div>
        {description != null && description !== '' && (
          <div className='config-view__field-desc'>{description}</div>
        )}
      </div>
    </div>
    <div className='config-view__field-control'>
      {children}
    </div>
  </div>
)

const DisplayValue = ({
  value,
  sectionKey,
  path = [],
  t
}: {
  value: unknown
  sectionKey: string
  path?: string[]
  t: (key: string, options?: { defaultValue?: string }) => string
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

const ComplexTextEditor = ({
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

const StringArrayEditor = ({
  value,
  onChange,
  t
}: {
  value: string[]
  onChange: (nextValue: string[]) => void
  t: (key: string, options?: { defaultValue?: string }) => string
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

const KeyValueEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, string>
  onChange: (nextValue: Record<string, string>) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__array-list'>
      {entries.map(([key, val]) => (
        <div key={key} className='config-view__array-item'>
          <div className='config-view__record-key'>{key}</div>
          {isSensitiveKey(key)
            ? (
              <Input.Password
                value={val}
                onChange={(event) => {
                  onChange({ ...value, [key]: event.target.value })
                }}
                placeholder={t('config.editor.fieldValue')}
              />
            )
            : (
              <Input
                value={val}
                onChange={(event) => {
                  onChange({ ...value, [key]: event.target.value })
                }}
                placeholder={t('config.editor.fieldValue')}
              />
            )}
          <Button
            size='small'
            onClick={() => {
              const updated = { ...value }
              delete updated[key]
              onChange(updated)
            }}
          >
            {t('config.editor.remove')}
          </Button>
        </div>
      ))}
      <div className='config-view__array-item'>
        <Input
          value={newKey}
          placeholder={t('config.editor.fieldKey')}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Input
          value={newValue}
          placeholder={t('config.editor.fieldValue')}
          onChange={(event) => setNewValue(event.target.value)}
        />
        <Button
          size='small'
          type='primary'
          disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
          onClick={() => {
            const nextValue = { ...value, [newKey]: newValue }
            onChange(nextValue)
            setNewKey('')
            setNewValue('')
          }}
        >
          {t('config.editor.addField')}
        </Button>
      </div>
    </div>
  )
}

const RecordJsonEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => (
        <div key={key} className='config-view__record-card'>
          <div className='config-view__record-title'>
            <span>{key}</span>
            <Button
              size='small'
              onClick={() => {
                const updated = { ...value }
                delete updated[key]
                onChange(updated)
              }}
            >
              {t('config.editor.remove')}
            </Button>
          </div>
          <ComplexTextEditor
            value={itemValue}
            onChange={(next) => {
              onChange({ ...value, [key]: next })
            }}
          />
        </div>
      ))}
      <div className='config-view__record-add'>
        <Input
          value={newKey}
          placeholder={t('config.editor.fieldKey')}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button
          size='small'
          type='primary'
          disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
          onClick={() => {
            onChange({ ...value, [newKey]: {} })
            setNewKey('')
          }}
        >
          {t('config.editor.addField')}
        </Button>
      </div>
    </div>
  )
}

const BooleanRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, boolean>
  onChange: (nextValue: Record<string, boolean>) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => (
        <div key={key} className='config-view__record-row'>
          <div className='config-view__record-key'>{key}</div>
          <Switch
            checked={Boolean(itemValue)}
            onChange={(next) => {
              onChange({ ...value, [key]: next })
            }}
          />
          <Button
            size='small'
            onClick={() => {
              const updated = { ...value }
              delete updated[key]
              onChange(updated)
            }}
          >
            {t('config.editor.remove')}
          </Button>
        </div>
      ))}
      <div className='config-view__record-add'>
        <Input
          value={newKey}
          placeholder={t('config.editor.fieldKey')}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button
          size='small'
          type='primary'
          disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
          onClick={() => {
            onChange({ ...value, [newKey]: true })
            setNewKey('')
          }}
        >
          {t('config.editor.addField')}
        </Button>
      </div>
    </div>
  )
}

const ModelServicesRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as Record<string, unknown>
          : {}
        const titleValue = typeof recordValue.title === 'string' ? recordValue.title : ''
        const descriptionValue = typeof recordValue.description === 'string' ? recordValue.description : ''
        const displayName = titleValue.trim() !== '' ? titleValue : key
        const models = Array.isArray(recordValue.models)
          ? recordValue.models.filter(item => typeof item === 'string')
          : []

        return (
          <div key={key} className='config-view__record-card'>
            <div className='config-view__record-title'>
              <div className='config-view__record-heading'>
                <div>{displayName}</div>
                {displayName !== key && (
                  <div className='config-view__record-subtitle'>{key}</div>
                )}
                {descriptionValue !== '' && (
                  <div className='config-view__record-desc'>{descriptionValue}</div>
                )}
              </div>
              <Button
                size='small'
                onClick={() => {
                  const updated = { ...value }
                  delete updated[key]
                  onChange(updated)
                }}
              >
                {t('config.editor.remove')}
              </Button>
            </div>
            <div className='config-view__record-fields'>
              <FieldRow
                title={t('config.fields.modelServices.item.title.label')}
                description={t('config.fields.modelServices.item.title.desc')}
                icon={getTypeIcon('string')}
              >
                <Input
                  value={titleValue}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, title: event.target.value } })
                  }}
                  placeholder={t('config.editor.titlePlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.description.label')}
                description={t('config.fields.modelServices.item.description.desc')}
                icon={getTypeIcon('string')}
                layout='stacked'
              >
                <Input.TextArea
                  value={descriptionValue}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, description: event.target.value } })
                  }}
                  autoSize={{ minRows: 2 }}
                  placeholder={t('config.editor.descriptionPlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.apiBaseUrl.label')}
                description={t('config.fields.modelServices.item.apiBaseUrl.desc')}
                icon={getTypeIcon('string')}
              >
                <Input
                  value={typeof recordValue.apiBaseUrl === 'string' ? recordValue.apiBaseUrl : ''}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, apiBaseUrl: event.target.value } })
                  }}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.apiKey.label')}
                description={t('config.fields.modelServices.item.apiKey.desc')}
                icon={getTypeIcon('string')}
              >
                <Input.Password
                  value={typeof recordValue.apiKey === 'string' ? recordValue.apiKey : ''}
                  onChange={(event) => {
                    onChange({ ...value, [key]: { ...recordValue, apiKey: event.target.value } })
                  }}
                  placeholder={t('config.editor.secretPlaceholder')}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.models.label')}
                description={t('config.fields.modelServices.item.models.desc')}
                icon={getTypeIcon('array')}
                layout='stacked'
              >
                <StringArrayEditor
                  value={models}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, models: next } })
                  }}
                  t={t}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.modelsAlias.label')}
                description={t('config.fields.modelServices.item.modelsAlias.desc')}
                icon={getTypeIcon('object')}
                layout='stacked'
              >
                <ComplexTextEditor
                  value={recordValue.modelsAlias ?? {}}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, modelsAlias: next } })
                  }}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.modelServices.item.extra.label')}
                description={t('config.fields.modelServices.item.extra.desc')}
                icon={getTypeIcon('object')}
                layout='stacked'
              >
                <ComplexTextEditor
                  value={recordValue.extra ?? {}}
                  onChange={(next) => {
                    onChange({ ...value, [key]: { ...recordValue, extra: next } })
                  }}
                />
              </FieldRow>
            </div>
          </div>
        )
      })}
      <div className='config-view__record-add'>
        <Input
          value={newKey}
          placeholder={t('config.editor.fieldKey')}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button
          size='small'
          type='primary'
          disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
          onClick={() => {
            onChange({
              ...value,
              [newKey]: {
                title: '',
                description: '',
                apiBaseUrl: '',
                apiKey: '',
                models: [],
                modelsAlias: {},
                extra: {}
              }
            })
            setNewKey('')
          }}
        >
          {t('config.editor.addField')}
        </Button>
      </div>
    </div>
  )
}

const McpServersRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(value)

  return (
    <div className='config-view__record-list'>
      {entries.map(([key, itemValue]) => {
        const recordValue = (itemValue != null && typeof itemValue === 'object')
          ? itemValue as Record<string, unknown>
          : {}
        const typeValue = typeof recordValue.type === 'string' ? recordValue.type : 'command'
        const envValue = (recordValue.env != null && typeof recordValue.env === 'object')
          ? recordValue.env as Record<string, string>
          : {}
        const headersValue = (recordValue.headers != null && typeof recordValue.headers === 'object')
          ? recordValue.headers as Record<string, string>
          : {}
        const argsValue = Array.isArray(recordValue.args)
          ? recordValue.args.filter(item => typeof item === 'string')
          : []

        const updateRecord = (nextValue: Record<string, unknown>) => {
          onChange({ ...value, [key]: nextValue })
        }

        return (
          <div key={key} className='config-view__record-card'>
            <div className='config-view__record-title'>
              <span>{key}</span>
              <Button
                size='small'
                onClick={() => {
                  const updated = { ...value }
                  delete updated[key]
                  onChange(updated)
                }}
              >
                {t('config.editor.remove')}
              </Button>
            </div>
            <div className='config-view__record-fields'>
              <FieldRow
                title={t('config.fields.mcpServer.enabled.label')}
                description={t('config.fields.mcpServer.enabled.desc')}
                icon={getTypeIcon('boolean')}
              >
                <Switch
                  checked={Boolean(recordValue.enabled)}
                  onChange={(next) => {
                    updateRecord({ ...recordValue, enabled: next })
                  }}
                />
              </FieldRow>
              <FieldRow
                title={t('config.fields.mcpServer.type.label')}
                description={t('config.fields.mcpServer.type.desc')}
                icon={getTypeIcon('string')}
              >
                <Select
                  value={typeValue}
                  options={[
                    { value: 'command', label: t('config.options.mcp.command') },
                    { value: 'sse', label: t('config.options.mcp.sse') },
                    { value: 'http', label: t('config.options.mcp.http') }
                  ]}
                  onChange={(next) => {
                    const nextRecord = { ...recordValue }
                    if (next === 'command') {
                      delete nextRecord.type
                      if (nextRecord.command == null) nextRecord.command = ''
                      if (nextRecord.args == null) nextRecord.args = []
                      delete nextRecord.url
                      delete nextRecord.headers
                    } else {
                      nextRecord.type = next
                      if (nextRecord.url == null) nextRecord.url = ''
                      if (nextRecord.headers == null) nextRecord.headers = {}
                      delete nextRecord.command
                      delete nextRecord.args
                    }
                    updateRecord(nextRecord)
                  }}
                />
              </FieldRow>
              {typeValue === 'command' && (
                <>
                  <FieldRow
                    title={t('config.fields.mcpServer.command.label')}
                    description={t('config.fields.mcpServer.command.desc')}
                    icon={getTypeIcon('string')}
                  >
                    <Input
                      value={typeof recordValue.command === 'string' ? recordValue.command : ''}
                      onChange={(event) => {
                        updateRecord({ ...recordValue, command: event.target.value })
                      }}
                      placeholder={t('config.editor.commandPlaceholder')}
                    />
                  </FieldRow>
                  <FieldRow
                    title={t('config.fields.mcpServer.args.label')}
                    description={t('config.fields.mcpServer.args.desc')}
                    icon={getTypeIcon('array')}
                    layout='stacked'
                  >
                    <StringArrayEditor
                      value={argsValue}
                      onChange={(next) => {
                        updateRecord({ ...recordValue, args: next })
                      }}
                      t={t}
                    />
                  </FieldRow>
                </>
              )}
              {typeValue !== 'command' && (
                <>
                  <FieldRow
                    title={t('config.fields.mcpServer.url.label')}
                    description={t('config.fields.mcpServer.url.desc')}
                    icon={getTypeIcon('string')}
                  >
                    <Input
                      value={typeof recordValue.url === 'string' ? recordValue.url : ''}
                      onChange={(event) => {
                        updateRecord({ ...recordValue, url: event.target.value })
                      }}
                      placeholder={t('config.editor.urlPlaceholder')}
                    />
                  </FieldRow>
                  <FieldRow
                    title={t('config.fields.mcpServer.headers.label')}
                    description={t('config.fields.mcpServer.headers.desc')}
                    icon={getTypeIcon('object')}
                    layout='stacked'
                  >
                    <KeyValueEditor
                      value={headersValue}
                      onChange={(next) => {
                        updateRecord({ ...recordValue, headers: next })
                      }}
                      t={t}
                    />
                  </FieldRow>
                </>
              )}
              <FieldRow
                title={t('config.fields.mcpServer.env.label')}
                description={t('config.fields.mcpServer.env.desc')}
                icon={getTypeIcon('object')}
                layout='stacked'
              >
                <KeyValueEditor
                  value={envValue}
                  onChange={(next) => {
                    updateRecord({ ...recordValue, env: next })
                  }}
                  t={t}
                />
              </FieldRow>
            </div>
          </div>
        )
      })}
      <div className='config-view__record-add'>
        <Input
          value={newKey}
          placeholder={t('config.editor.fieldKey')}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <Button
          size='small'
          type='primary'
          disabled={newKey.trim() === '' || Object.hasOwn(value, newKey)}
          onClick={() => {
            onChange({
              ...value,
              [newKey]: {
                enabled: true,
                command: '',
                args: []
              }
            })
            setNewKey('')
          }}
        >
          {t('config.editor.addField')}
        </Button>
      </div>
    </div>
  )
}

const SectionForm = ({
  sectionKey,
  value,
  onChange,
  mergedModelServices,
  selectedModelService,
  t
}: {
  sectionKey: string
  value: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  selectedModelService?: string
  t: (key: string, options?: { defaultValue?: string }) => string
}) => {
  const fields = configSchema[sectionKey] ?? []
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

  const groupedFields = fields.reduce<Record<string, FieldSpec[]>>((acc, field) => {
    const key = field.group ?? 'default'
    if (!acc[key]) acc[key] = []
    acc[key].push(field)
    return acc
  }, {})
  const orderedGroups = ['base', 'items', 'default'].filter(key => groupedFields[key]?.length)

  const renderField = (field: FieldSpec) => {
    const fieldValue = getValueByPath(value, field.path)
    const valueToUse = fieldValue !== undefined ? fieldValue : field.defaultValue
    const label = field.labelKey
      ? t(field.labelKey)
      : getFieldLabel(t, sectionKey, field.path, field.path[field.path.length - 1] ?? '')
    const description = field.descriptionKey
      ? t(field.descriptionKey)
      : getFieldDescription(t, sectionKey, field.path)

    const handleValueChange = (nextValue: unknown) => {
      const nextSectionValue = setValueByPath(value, field.path, nextValue)
      onChange(nextSectionValue)
    }

    let control: ReactNode = null
    const isStacked = ['multiline', 'json', 'record', 'string[]'].includes(field.type)

    if (field.type === 'string') {
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
          />
        )
      }
    } else if (field.type === 'multiline') {
      const currentText = typeof valueToUse === 'string' ? valueToUse : ''
      control = (
        <div className='config-view__multiline'>
          <Input.TextArea
            className='config-view__multiline-input'
            value={currentText}
            onChange={(event) => handleValueChange(event.target.value)}
            autoSize={{ minRows: 3 }}
            placeholder={t('config.editor.multilinePlaceholder')}
          />
        </div>
      )
    } else if (field.type === 'number') {
      control = (
        <InputNumber
          value={typeof valueToUse === 'number' ? valueToUse : 0}
          onChange={(next) => handleValueChange(typeof next === 'number' ? next : 0)}
        />
      )
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
      const isDefaultModelService = sectionKey === 'general' && field.path.join('.') === 'defaultModelService'
      const isDefaultModel = sectionKey === 'general' && field.path.join('.') === 'defaultModel'
      const options: Array<{ value: string; label: ReactNode }> = isDefaultModelService
        ? modelServiceOptions
        : isDefaultModel
        ? modelOptions
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
            isDefaultModelService
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
    } else if (field.type === 'record') {
      const recordValue = (valueToUse != null && typeof valueToUse === 'object')
        ? valueToUse as Record<string, unknown>
        : {}
      if (field.recordKind === 'modelServices') {
        control = (
          <ModelServicesRecordEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'mcpServers') {
        control = (
          <McpServersRecordEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'keyValue') {
        control = (
          <KeyValueEditor
            value={recordValue as Record<string, string>}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else if (field.recordKind === 'boolean') {
        control = (
          <BooleanRecordEditor
            value={recordValue as Record<string, boolean>}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      } else {
        control = (
          <RecordJsonEditor
            value={recordValue}
            onChange={(next) => handleValueChange(next)}
            t={t}
          />
        )
      }
    }

    return (
      <FieldRow
        key={`${field.path.join('.')}-${field.type}-${field.labelKey ?? ''}-${field.recordKind ?? ''}`}
        title={label}
        description={description}
        icon={getTypeIcon(getValueType(valueToUse))}
        layout={isStacked ? 'stacked' : 'inline'}
      >
        {control}
      </FieldRow>
    )
  }

  return (
    <div className='config-view__field-stack'>
      {orderedGroups.map((groupKey) => {
        const groupFields = groupedFields[groupKey] ?? []
        if (groupKey === 'base') {
          if (sectionKey === 'plugins') {
            return (
              <div key={groupKey} className='config-view__subsection'>
                <div className='config-view__subsection-title'>
                  {t('config.sectionGroups.base')}
                </div>
                <div className='config-view__subsection-body'>
                  {groupFields.map(renderField)}
                </div>
              </div>
            )
          }
          const hasBaseValues = groupFields.some((field) => {
            const fieldValue = getValueByPath(value, field.path)
            if (typeof fieldValue === 'boolean') return fieldValue
            return !isEmptyValue(fieldValue)
          })
          if (!hasBaseValues) {
            return null
          }
        }
        if (groupKey === 'default') {
          return (
            <div key={groupKey} className='config-view__field-list'>
              {groupFields.map(renderField)}
            </div>
          )
        }
        return (
          <div key={groupKey} className='config-view__subsection'>
            <div className='config-view__subsection-title'>
              {groupKey === 'base'
                ? t('config.sectionGroups.base')
                : sectionKey === 'plugins'
                  ? t('config.sectionGroups.plugins')
                  : t('config.sectionGroups.items')}
            </div>
            <div className='config-view__subsection-body'>
              {groupFields.map(renderField)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const AboutSection = ({ value }: { value?: AboutInfo }) => {
  const { t } = useTranslation()
  const aboutInfo = (value != null && typeof value === 'object')
    ? value
    : undefined
  const urls = aboutInfo?.urls
  const version = aboutInfo?.version
  const lastReleaseAt = aboutInfo?.lastReleaseAt

  return (
    <div className='config-about'>
      <div className='config-about__card'>
        <div className='config-about__app'>
          <div className='config-about__app-icon'>
            <span className='material-symbols-rounded'>auto_awesome</span>
          </div>
          <div className='config-about__app-info'>
            <div className='config-about__app-title'>
              {t('config.about.software')}
            </div>
            <div className='config-about__app-meta'>
              <span className='config-about__app-version'>
                {t('config.about.version')}: {version ?? t('config.about.unknown')}
              </span>
              <span className='config-about__app-date'>
                {lastReleaseAt ?? t('config.about.unknown')}
              </span>
            </div>
          </div>
        </div>
        <a
          className='config-about__primary'
          href={urls?.releases ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          {t('config.about.checkUpdate')}
        </a>
      </div>

      <div className='config-about__list'>
        <a
          className='config-about__item-row'
          href={urls?.docs ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>menu_book</span>
            <span>{t('config.about.docs')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
        <a
          className='config-about__item-row'
          href={urls?.contact ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>mail</span>
            <span>{t('config.about.contact')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
        <a
          className='config-about__item-row'
          href={urls?.issues ?? urls?.repo}
          target='_blank'
          rel='noreferrer'
        >
          <span className='config-about__item-left'>
            <span className='material-symbols-rounded config-about__item-icon'>bug_report</span>
            <span>{t('config.about.feedback')}</span>
          </span>
          <span className='material-symbols-rounded config-about__arrow'>open_in_new</span>
        </a>
      </div>
    </div>
  )
}

export function ConfigView() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { data, isLoading, error, mutate } = useSWR<ConfigResponse>('/api/config', getConfig)
  const [sourceKey, setSourceKey] = useState<SourceKey>('project')
  const [activeTabKey, setActiveTabKey] = useState('general')
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const configPresent = data?.meta?.configPresent
  const currentSource = data?.sources?.[sourceKey]
  const draftsRef = useRef<Record<string, unknown>>(drafts)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savingRef = useRef<Record<string, boolean>>({})
  const lastSavedRef = useRef<Record<string, string>>({})
  const mergedModelServices = useMemo(() => data?.sources?.merged?.modelServices ?? {}, [
    data?.sources?.merged?.modelServices
  ])

  useEffect(() => {
    if (configPresent?.project) {
      setSourceKey('project')
    } else if (configPresent?.user) {
      setSourceKey('user')
    }
  }, [configPresent?.project, configPresent?.user])

  const configTabKeys = useMemo(() =>
    new Set([
      'general',
      'conversation',
      'modelServices',
      'adapters',
      'plugins',
      'mcp',
      'shortcuts'
    ]), [])

  const tabs = useMemo(() => [
    { key: 'group-config', type: 'group', label: t('config.groups.config') },
    { key: 'general', icon: 'tune', label: t('config.sections.general'), value: currentSource?.general },
    {
      key: 'conversation',
      icon: 'forum',
      label: t('config.sections.conversation'),
      value: currentSource?.conversation
    },
    {
      key: 'modelServices',
      icon: 'model_training',
      label: t('config.sections.modelServices'),
      value: currentSource?.modelServices
    },
    {
      key: 'adapters',
      icon: 'settings_input_component',
      label: t('config.sections.adapters'),
      value: currentSource?.adapters
    },
    { key: 'plugins', icon: 'extension', label: t('config.sections.plugins'), value: currentSource?.plugins },
    { key: 'mcp', icon: 'account_tree', label: t('config.sections.mcp'), value: currentSource?.mcp },
    { key: 'shortcuts', icon: 'keyboard', label: t('config.sections.shortcuts'), value: currentSource?.shortcuts },
    { key: 'group-app', type: 'group', label: t('config.groups.app') },
    { key: 'experiments', icon: 'science', label: t('config.sections.experiments'), value: data?.meta?.experiments },
    { key: 'about', icon: 'info', label: t('config.sections.about'), value: data?.meta?.about }
  ], [currentSource, data?.meta?.about, data?.meta?.experiments, t])

  const activeTab = useMemo(() => tabs.find(tab => tab.key === activeTabKey), [tabs, activeTabKey])

  useEffect(() => {
    if (activeTab == null) return
    if (!configTabKeys.has(activeTab.key)) return
    const draftKey = `${sourceKey}:${activeTab.key}`
    setDrafts((prev) => {
      const currentDraft = prev[draftKey]
      const sourceValue = activeTab.value ?? {}
      if (currentDraft !== undefined) {
        if (isEmptyValue(currentDraft) && !isEmptyValue(sourceValue)) {
          return { ...prev, [draftKey]: cloneValue(sourceValue) }
        }
        return prev
      }
      return { ...prev, [draftKey]: cloneValue(sourceValue) }
    })
  }, [activeTab, configTabKeys, sourceKey])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [])

  const getDraftKey = (sectionKey: string, source = sourceKey) => `${source}:${sectionKey}`
  const generalDraftValue = useMemo(() => {
    const draftKey = getDraftKey('general')
    return (drafts[draftKey] ?? cloneValue(currentSource?.general ?? {}) ?? {}) as Record<string, unknown>
  }, [drafts, currentSource?.general, sourceKey])
  const selectedModelService = (() => {
    const value = getValueByPath(generalDraftValue, ['defaultModelService'])
    return typeof value === 'string' ? value : undefined
  })()

  const scheduleSave = (sectionKey: string, source: SourceKey, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey, source)
    const serialized = JSON.stringify(nextValue ?? {})
    if (lastSavedRef.current[draftKey] === serialized) {
      return
    }
    if (saveTimersRef.current[draftKey]) {
      clearTimeout(saveTimersRef.current[draftKey])
    }
    saveTimersRef.current[draftKey] = setTimeout(async () => {
      if (savingRef.current[draftKey]) return
      const currentValue = draftsRef.current[draftKey] ?? nextValue
      const currentSerialized = JSON.stringify(currentValue ?? {})
      if (lastSavedRef.current[draftKey] === currentSerialized) return
      savingRef.current[draftKey] = true
      try {
        await updateConfig(source, sectionKey, currentValue)
        lastSavedRef.current[draftKey] = currentSerialized
        await mutate()
      } catch {
        void message.error(t('config.saveFailed'))
      } finally {
        savingRef.current[draftKey] = false
      }
    }, 800)
  }

  const handleDraftChange = (sectionKey: string, nextValue: unknown) => {
    const draftKey = getDraftKey(sectionKey)
    setDrafts(prev => ({ ...prev, [draftKey]: nextValue }))
    scheduleSave(sectionKey, sourceKey, nextValue)
  }

  return (
    <div className='config-view'>
      {isLoading && (
        <div className='config-view__state'>
          <Spin />
        </div>
      )}
      {!isLoading && (error != null) && (
        <div className='config-view__state'>
          <Empty description={t('config.loadFailed')} />
        </div>
      )}
      {!isLoading && error == null && (
        <div className='config-view__tabs-wrap'>
          <Tabs
            tabPosition='left'
            tabBarGutter={0}
            indicator={{ size: 0 }}
            className='config-view__tabs'
            activeKey={activeTabKey}
            onChange={(key) => {
              if (key !== 'group-config' && key !== 'group-app') {
                setActiveTabKey(key)
              }
            }}
            items={tabs.map((tab) => {
              if (tab.type === 'group') {
                return {
                  key: tab.key,
                  label: <span className='config-view__group-label'>{tab.label}</span>,
                  disabled: true,
                  children: <div />
                }
              }
              return {
                key: tab.key,
                label: (
                  <span className='config-view__tab-label'>
                    <span className='material-symbols-rounded config-view__tab-icon'>{tab.icon}</span>
                    <span className='config-view__tab-text'>{tab.label}</span>
                  </span>
                ),
                children: (
                  <div className='config-view__content'>
                    {tab.key === 'about' && (
                      <AboutSection value={tab.value as AboutInfo | undefined} />
                    )}
                    {tab.key !== 'about' && !configTabKeys.has(tab.key) && (
                      <DisplayValue value={tab.value} sectionKey={tab.key} t={t} />
                    )}
                    {configTabKeys.has(tab.key) && (
                      <div className='config-view__editor-wrap'>
                        <div className='config-view__section-header'>
                          <div className='config-view__section-title'>
                            <span className='material-symbols-rounded config-view__section-icon'>
                              {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                          </div>
                          <Space size={12}>
                            <Radio.Group
                              value={sourceKey}
                              optionType='button'
                              buttonStyle='solid'
                              size='small'
                              onChange={(event) => {
                                const value = event.target.value as SourceKey
                                setSourceKey(value)
                              }}
                              options={[
                                {
                                  label: (
                                    <span className='config-view__source-option'>
                                      <span className='material-symbols-rounded'>folder</span>
                                      <span>
                                        {configPresent?.project === true
                                          ? t('config.sources.project')
                                          : t('config.sources.projectMissing')}
                                      </span>
                                    </span>
                                  ),
                                  value: 'project'
                                },
                                {
                                  label: (
                                    <span className='config-view__source-option'>
                                      <span className='material-symbols-rounded'>person</span>
                                      <span>
                                        {configPresent?.user === true
                                          ? t('config.sources.user')
                                          : t('config.sources.userMissing')}
                                      </span>
                                    </span>
                                  ),
                                  value: 'user'
                                }
                              ]}
                            />
                          </Space>
                        </div>
                        <div className='config-view__card'>
                          <SectionForm
                            sectionKey={tab.key}
                            value={drafts[getDraftKey(tab.key)] ?? cloneValue(tab.value ?? {}) ?? {}}
                            onChange={(next) => handleDraftChange(tab.key, next)}
                            mergedModelServices={mergedModelServices as Record<string, unknown>}
                            selectedModelService={selectedModelService}
                            t={t}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            })}
          />
        </div>
      )}
    </div>
  )
}
