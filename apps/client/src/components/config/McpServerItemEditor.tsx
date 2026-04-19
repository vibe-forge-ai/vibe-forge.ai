import { Input, Select, Switch } from 'antd'

import { StringArrayEditor } from './ConfigEditors'
import { FieldRow } from './ConfigFieldRow'
import { getTypeIcon } from './configUtils'
import type { TranslationFn } from './configUtils'
import { KeyValueEditor } from './record-editors'

export const McpServerItemEditor = ({
  value,
  onChange,
  t
}: {
  value: Record<string, unknown>
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
}) => {
  const typeValue = typeof value.type === 'string' ? value.type : 'command'
  const envValue = (value.env != null && typeof value.env === 'object')
    ? value.env as Record<string, string>
    : {}
  const headersValue = (value.headers != null && typeof value.headers === 'object')
    ? value.headers as Record<string, string>
    : {}
  const argsValue = Array.isArray(value.args)
    ? value.args.filter(item => typeof item === 'string')
    : []

  return (
    <div className='config-view__field-stack'>
      <FieldRow
        title={t('config.fields.mcpServer.enabled.label')}
        description={t('config.fields.mcpServer.enabled.desc')}
        icon={getTypeIcon('boolean')}
      >
        <Switch
          checked={Boolean(value.enabled)}
          onChange={(next) => {
            onChange({ ...value, enabled: next })
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
            const nextValue = { ...value }
            if (next === 'command') {
              delete nextValue.type
              if (nextValue.command == null) nextValue.command = ''
              if (nextValue.args == null) nextValue.args = []
              delete nextValue.url
              delete nextValue.headers
            } else {
              nextValue.type = next
              if (nextValue.url == null) nextValue.url = ''
              if (nextValue.headers == null) nextValue.headers = {}
              delete nextValue.command
              delete nextValue.args
            }
            onChange(nextValue)
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
              value={typeof value.command === 'string' ? value.command : ''}
              onChange={(event) => {
                onChange({ ...value, command: event.target.value })
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
                onChange({ ...value, args: next })
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
              value={typeof value.url === 'string' ? value.url : ''}
              onChange={(event) => {
                onChange({ ...value, url: event.target.value })
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
                onChange({ ...value, headers: next })
              }}
              t={t}
              keyPlaceholder={t('config.editor.newHeaderName')}
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
            onChange({ ...value, env: next })
          }}
          t={t}
          keyPlaceholder={t('config.editor.newEnvVarName')}
        />
      </FieldRow>
    </div>
  )
}
