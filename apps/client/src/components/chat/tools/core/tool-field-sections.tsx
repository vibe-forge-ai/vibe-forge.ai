import { Tooltip } from 'antd'
import React from 'react'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'

import { TOOL_TOOLTIP_PROPS, getToolFieldIcon, getToolInlineValueText, getToolValueText } from './tool-display'

type Translate = (key: string, options?: Record<string, unknown>) => string

export type ToolFieldFormat = 'inline' | 'text' | 'code' | 'list' | 'json' | 'questions'

export interface ToolFieldView {
  labelKey: string
  fallbackLabel: string
  format: ToolFieldFormat
  value: unknown
  lang?: string
}

const getFieldKey = (field: ToolFieldView, index: number) => `${field.labelKey}-${index}`

const getSectionHeader = (icon: string, label: string) => (
  <div className='tool-detail-section__header'>
    <Tooltip title={label} {...TOOL_TOOLTIP_PROPS}>
      <span className='tool-detail-section__icon material-symbols-rounded'>{icon}</span>
    </Tooltip>
  </div>
)

export function ToolInlineFields({
  fields,
  t
}: {
  fields: ToolFieldView[]
  t: Translate
}) {
  if (fields.length === 0) {
    return null
  }

  return (
    <div
      className='tool-inline-token-list tool-inline-token-list--standalone'
      aria-label={t('chat.tools.fields.details')}
    >
      {fields.map((field, index) => {
        const label = t(field.labelKey, { defaultValue: field.fallbackLabel })
        const valueText = getToolInlineValueText(field.value)
        return (
          <Tooltip
            key={getFieldKey(field, index)}
            title={
              <div className='tool-tooltip-content'>
                <div className='tool-tooltip-content__title'>{label}</div>
                <div className='tool-tooltip-content__value'>{getToolValueText(field.value)}</div>
              </div>
            }
            {...TOOL_TOOLTIP_PROPS}
          >
            <div className='tool-inline-token'>
              <span className='tool-inline-token__icon material-symbols-rounded'>
                {getToolFieldIcon(field.labelKey, field.format)}
              </span>
              <span className='tool-inline-token__value'>{valueText}</span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function renderToolBlockField(
  field: ToolFieldView,
  index: number,
  t: Translate,
  options: {
    sectionClassName?: string
    hideHeader?: boolean
  } = {}
) {
  const label = t(field.labelKey, { defaultValue: field.fallbackLabel })
  const sectionHeader = options.hideHeader
    ? null
    : getSectionHeader(getToolFieldIcon(field.labelKey, field.format), label)
  const sectionClassName = options.sectionClassName ?? 'tool-detail-section'

  if (field.format === 'text') {
    return (
      <div className={sectionClassName} key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='tool-detail-section__text'>{String(field.value)}</div>
      </div>
    )
  }

  if (field.format === 'code') {
    return (
      <div className={sectionClassName} key={getFieldKey(field, index)}>
        {sectionHeader}
        <CodeBlock
          code={String(field.value)}
          lang={field.lang ?? 'text'}
          hideHeader={true}
        />
      </div>
    )
  }

  if (field.format === 'list') {
    const items = Array.isArray(field.value) ? field.value.map(item => String(item)) : []
    return (
      <div className={sectionClassName} key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='tool-detail-list'>
          {items.map(listItem => (
            <div className='tool-detail-list-item' key={listItem}>{listItem}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={sectionClassName} key={getFieldKey(field, index)}>
      {sectionHeader}
      <CodeBlock
        code={safeJsonStringify(field.value, 2)}
        lang='json'
        hideHeader={true}
      />
    </div>
  )
}
