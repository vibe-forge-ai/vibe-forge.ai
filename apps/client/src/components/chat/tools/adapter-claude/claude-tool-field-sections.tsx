import { Tooltip } from 'antd'
import React from 'react'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'

import { TOOL_TOOLTIP_PROPS, getToolFieldIcon, getToolInlineValueText, getToolValueText } from '../core/tool-display'
import type { ClaudeToolField, ClaudeToolQuestion } from './claude-tool-presentation'

type Translate = (key: string, options?: Record<string, unknown>) => string

const getFieldKey = (field: ClaudeToolField, index: number) => `${field.labelKey}-${index}`

const getSectionHeader = (icon: string, label: string) => (
  <div className='tool-detail-section__header'>
    <Tooltip title={label} {...TOOL_TOOLTIP_PROPS}>
      <span className='tool-detail-section__icon material-symbols-rounded'>{icon}</span>
    </Tooltip>
  </div>
)

export function ClaudeToolInlineFields({
  fields,
  t
}: {
  fields: ClaudeToolField[]
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

export function renderClaudeBlockField(field: ClaudeToolField, index: number, t: Translate) {
  const label = t(field.labelKey, { defaultValue: field.fallbackLabel })
  const sectionHeader = getSectionHeader(getToolFieldIcon(field.labelKey, field.format), label)

  if (field.format === 'text') {
    return (
      <div className='tool-detail-section claude-generic-tool__section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='tool-detail-section__text'>{String(field.value)}</div>
      </div>
    )
  }

  if (field.format === 'code') {
    return (
      <div className='tool-detail-section claude-generic-tool__section' key={getFieldKey(field, index)}>
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
      <div className='tool-detail-section claude-generic-tool__section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='claude-generic-tool__list'>
          {items.map(listItem => (
            <div className='claude-generic-tool__list-item' key={listItem}>{listItem}</div>
          ))}
        </div>
      </div>
    )
  }

  if (field.format === 'questions') {
    const questions = Array.isArray(field.value) ? field.value as ClaudeToolQuestion[] : []
    return (
      <div className='tool-detail-section claude-generic-tool__section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='claude-generic-tool__questions'>
          {questions.map((question, questionIndex) => (
            <div
              className='claude-generic-tool__question'
              key={`${question.header ?? question.question}-${questionIndex}`}
            >
              <div className='claude-generic-tool__question-header'>
                <div className='claude-generic-tool__question-title'>
                  {question.header ?? `${label} ${questionIndex + 1}`}
                </div>
                <Tooltip
                  title={question.multiSelect
                    ? t('chat.tools.multiSelect')
                    : t('chat.tools.singleSelect')}
                  {...TOOL_TOOLTIP_PROPS}
                >
                  <span className='claude-generic-tool__question-mode material-symbols-rounded'>
                    {question.multiSelect ? 'checklist' : 'radio_button_checked'}
                  </span>
                </Tooltip>
              </div>
              <div
                className='tool-detail-section__text'
                title={question.question}
              >
                {question.question}
              </div>
              {question.options.length > 0 && (
                <div className='claude-generic-tool__question-options'>
                  {question.options.map(option => (
                    <div className='claude-generic-tool__question-option' key={option.label}>
                      <div className='claude-generic-tool__question-option-label'>{option.label}</div>
                      {option.description != null && option.description !== '' && (
                        <div className='claude-generic-tool__question-option-description'>
                          {option.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='tool-detail-section claude-generic-tool__section' key={getFieldKey(field, index)}>
      {sectionHeader}
      <CodeBlock
        code={safeJsonStringify(field.value, 2)}
        lang='json'
        hideHeader={true}
      />
    </div>
  )
}
