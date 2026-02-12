import './ConfigRecordEditors.scss'

import { Button, Input, Select, Switch } from 'antd'
import { useState } from 'react'

import { ComplexTextEditor, StringArrayEditor } from './ConfigEditors'
import { FieldRow } from './ConfigFieldRow'
import { getTypeIcon, isSensitiveKey } from './configUtils'
import type { TranslationFn } from './configUtils'

export const KeyValueEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, string>
  onChange: (nextValue: Record<string, string>) => void
  t: TranslationFn
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

export const RecordJsonEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
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

export const BooleanRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, boolean>
  onChange: (nextValue: Record<string, boolean>) => void
  t: TranslationFn
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

export const ModelServicesRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
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

export const McpServersRecordEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
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
