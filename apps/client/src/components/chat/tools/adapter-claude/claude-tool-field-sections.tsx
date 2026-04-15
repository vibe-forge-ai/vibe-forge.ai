import { Tooltip } from 'antd'
import React from 'react'

import { TOOL_TOOLTIP_PROPS, getToolFieldIcon } from '../core/tool-display'
import { renderToolBlockField } from '../core/tool-field-sections'
import type { ClaudeToolField, ClaudeToolQuestion } from './claude-tool-presentation'

type Translate = (key: string, options?: Record<string, unknown>) => string

export { ToolInlineFields as ClaudeToolInlineFields } from '../core/tool-field-sections'

const getSectionHeader = (icon: string, label: string) => (
  <div className='tool-detail-section__header'>
    <Tooltip title={label} {...TOOL_TOOLTIP_PROPS}>
      <span className='tool-detail-section__icon material-symbols-rounded'>{icon}</span>
    </Tooltip>
  </div>
)

export function renderClaudeBlockField(field: ClaudeToolField, index: number, t: Translate) {
  const label = t(field.labelKey, { defaultValue: field.fallbackLabel })
  const sectionHeader = getSectionHeader(getToolFieldIcon(field.labelKey, field.format), label)

  if (field.format === 'questions') {
    const questions = Array.isArray(field.value) ? field.value as ClaudeToolQuestion[] : []
    return (
      <div
        className='tool-detail-section claude-generic-tool__section'
        key={`${field.labelKey}-${index}`}
      >
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

  return renderToolBlockField(field, index, t, {
    sectionClassName: 'tool-detail-section claude-generic-tool__section'
  })
}
