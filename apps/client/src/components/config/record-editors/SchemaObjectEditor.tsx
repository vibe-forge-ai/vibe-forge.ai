import { Input, InputNumber, Select, Switch } from 'antd'
import type { ReactNode } from 'react'

import type { ConfigUiField, ConfigUiFieldOption, ConfigUiObjectSchema } from '@vibe-forge/types'

import { ComplexTextEditor, StringArrayEditor } from '../ConfigEditors'
import { FieldRow } from '../ConfigFieldRow'
import { getTypeIcon, getValueByPath, isSensitiveKey, setValueByPath } from '../configUtils'
import type { TranslationFn } from '../configUtils'

import { toLabel } from './schemaRecordUtils'

const buildSelectOptions = (options: ConfigUiFieldOption[] = []) => (
  options.map(option => ({
    value: option.value,
    label: option.label ?? option.value
  }))
)
const configSelectSuffixIcon = (
  <span className='material-symbols-rounded config-view__select-chevron'>expand_more</span>
)

const resolveFieldIcon = (field: ConfigUiField) => {
  if (field.icon != null) return field.icon
  if (field.type === 'json') return getTypeIcon('object')
  if (field.type === 'string[]') return getTypeIcon('array')
  if (field.type === 'select' || field.type === 'multiline') return getTypeIcon('string')
  if (field.type === 'string' || field.type === 'number' || field.type === 'boolean') {
    return getTypeIcon(field.type)
  }
  return getTypeIcon('object')
}

export const SchemaObjectEditor = ({
  value,
  schema,
  onChange,
  t,
  hideFieldPaths,
  visibleFieldPaths,
  resolveFieldLabel,
  resolveFieldDescription,
  resolveFieldOptions
}: {
  value: Record<string, unknown>
  schema: ConfigUiObjectSchema
  onChange: (nextValue: Record<string, unknown>) => void
  t: TranslationFn
  hideFieldPaths?: string[][]
  visibleFieldPaths?: string[][]
  resolveFieldLabel?: (field: ConfigUiField, fallback: string) => string
  resolveFieldDescription?: (field: ConfigUiField, fallback: string) => string
  resolveFieldOptions?: (field: ConfigUiField) => ConfigUiFieldOption[] | undefined
}) => {
  const renderField = (field: ConfigUiField) => {
    if (
      visibleFieldPaths != null && !visibleFieldPaths.some(visiblePath => (
        field.path.length === visiblePath.length &&
        field.path.every((segment, index) => segment === visiblePath[index])
      ))
    ) {
      return null
    }

    if (
      hideFieldPaths?.some(hiddenPath => (
        field.path.length === hiddenPath.length &&
        field.path.every((segment, index) => segment === hiddenPath[index])
      ))
    ) {
      return null
    }

    const currentValue = getValueByPath(value, field.path)
    const valueToUse = currentValue !== undefined ? currentValue : field.defaultValue
    const fallbackTitle = field.label ?? toLabel(field.path[field.path.length - 1] ?? '')
    const fallbackDescription = field.description ?? ''
    const title = resolveFieldLabel?.(field, fallbackTitle) ?? fallbackTitle
    const description = resolveFieldDescription?.(field, fallbackDescription) ?? fallbackDescription
    const resolvedOptions = resolveFieldOptions?.(field)
    const nextValue = (updated: unknown) => {
      onChange(setValueByPath(value, field.path, updated) as Record<string, unknown>)
    }

    let control: ReactNode = null
    const stacked = field.type === 'json' || field.type === 'multiline' || field.type === 'string[]'

    if (field.type === 'string' && resolvedOptions != null) {
      control = (
        <Select
          allowClear
          value={typeof valueToUse === 'string' && valueToUse !== '' ? valueToUse : undefined}
          options={buildSelectOptions(resolvedOptions)}
          placeholder={field.placeholder}
          suffixIcon={configSelectSuffixIcon}
          onChange={(selected) => nextValue(typeof selected === 'string' ? selected : undefined)}
        />
      )
    } else if (field.type === 'string') {
      const sensitive = field.sensitive === true || isSensitiveKey(field.path[field.path.length - 1] ?? '')
      control = sensitive
        ? (
          <Input.Password
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => nextValue(event.target.value)}
            placeholder={field.placeholder ?? t('config.editor.secretPlaceholder')}
          />
        )
        : (
          <Input
            value={typeof valueToUse === 'string' ? valueToUse : ''}
            onChange={(event) => nextValue(event.target.value)}
            placeholder={field.placeholder}
          />
        )
    } else if (field.type === 'multiline') {
      control = (
        <Input.TextArea
          value={typeof valueToUse === 'string' ? valueToUse : ''}
          onChange={(event) => nextValue(event.target.value)}
          autoSize={{ minRows: 2 }}
          placeholder={field.placeholder}
        />
      )
    } else if (field.type === 'number') {
      control = (
        <InputNumber
          value={typeof valueToUse === 'number' ? valueToUse : undefined}
          onChange={(input) => nextValue(typeof input === 'number' ? input : undefined)}
        />
      )
    } else if (field.type === 'boolean') {
      control = (
        <Switch
          checked={Boolean(valueToUse)}
          onChange={(checked) => nextValue(checked)}
        />
      )
    } else if (field.type === 'string[]') {
      control = (
        <StringArrayEditor
          value={Array.isArray(valueToUse) ? valueToUse.filter(item => typeof item === 'string') : []}
          onChange={(items) => nextValue(items)}
          t={t}
        />
      )
    } else if (field.type === 'select') {
      control = (
        <Select
          value={typeof valueToUse === 'string' ? valueToUse : undefined}
          options={buildSelectOptions(resolvedOptions ?? field.options ?? [])}
          suffixIcon={configSelectSuffixIcon}
          onChange={(selected) => nextValue(selected)}
        />
      )
    } else {
      control = (
        <ComplexTextEditor
          value={valueToUse ?? {}}
          onChange={(updated) => nextValue(updated)}
        />
      )
    }

    return (
      <FieldRow
        key={field.path.join('.')}
        title={title}
        description={description}
        icon={resolveFieldIcon(field)}
        layout={stacked ? 'stacked' : 'inline'}
      >
        {control}
      </FieldRow>
    )
  }

  return (
    <div className='config-view__record-fields'>
      {schema.fields.map(renderField)}
    </div>
  )
}
