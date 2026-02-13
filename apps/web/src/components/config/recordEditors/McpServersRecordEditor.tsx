import './McpServersRecordEditor.scss'

import { Button, Input, Select, Switch, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { FieldRow } from '../ConfigFieldRow'
import { getTypeIcon } from '../configUtils'
import type { TranslationFn } from '../configUtils'
import { KeyValueEditor } from './KeyValueEditor'
import { StringArrayEditor } from '../ConfigEditors'

export const McpServersRecordEditor = ({
  value,
  onChange,
  t,
  keyPlaceholder
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
  keyPlaceholder: string
}) => {
  const [newKey, setNewKey] = useState('')
  const entries = useMemo(() => Object.entries(value), [value])
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(entries.map(([key]) => [key, true]))
  ))

  useEffect(() => {
    setCollapsedKeys(prev => {
      const next: Record<string, boolean> = {}
      for (const [key] of entries) {
        next[key] = prev[key] ?? true
      }
      return next
    })
  }, [entries])

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

        const isCollapsed = collapsedKeys[key] === true
        return (
          <div
            key={key}
            className={`config-view__record-card${isCollapsed ? ' config-view__record-card--collapsed' : ''}`}
          >
            <div className='config-view__record-title'>
              <div className='config-view__record-title-left'>
                <Tooltip title={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}>
                  <Button
                    size='small'
                    type='text'
                    className='config-view__icon-button config-view__icon-button--compact'
                    aria-label={isCollapsed ? t('config.editor.expand') : t('config.editor.collapse')}
                    icon={<span className='material-symbols-rounded'>{isCollapsed ? 'chevron_right' : 'expand_more'}</span>}
                    onClick={() => {
                      setCollapsedKeys(prev => ({ ...prev, [key]: !isCollapsed }))
                    }}
                  />
                </Tooltip>
                <span>{key}</span>
              </div>
              <Tooltip title={t('config.editor.remove')}>
                <Button
                  size='small'
                  type='text'
                  danger
                  className='config-view__icon-button config-view__icon-button--compact'
                  aria-label={t('config.editor.remove')}
                  icon={<span className='material-symbols-rounded'>delete</span>}
                  onClick={() => {
                    const updated = { ...value }
                    delete updated[key]
                    onChange(updated)
                  }}
                />
              </Tooltip>
            </div>
            <div className='config-view__record-body'>
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
                  addLabel={t('config.editor.addHeader')}
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
                  addLabel={t('config.editor.addEnvVar')}
                />
              </FieldRow>
              </div>
            </div>
          </div>
        )
      })}
      <div className='config-view__record-add'>
        <div className='config-view__record-add-inputs'>
          <Input
            value={newKey}
            placeholder={keyPlaceholder}
            onChange={(event) => setNewKey(event.target.value)}
          />
        </div>
        <Tooltip title={t('config.editor.addMcpServer')}>
          <Button
            size='small'
            type='primary'
            className='config-view__icon-button config-view__icon-button--full'
            aria-label={t('config.editor.addMcpServer')}
            icon={<span className='material-symbols-rounded'>add</span>}
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
          />
        </Tooltip>
      </div>
    </div>
  )
}
