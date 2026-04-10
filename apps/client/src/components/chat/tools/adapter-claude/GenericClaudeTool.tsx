import './GenericClaudeTool.scss'

import { Tooltip } from 'antd'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { hasMeaningfulToolValue } from '../core/tool-content-presence'
import {
  getToolFieldIcon,
  getToolInlineValueText,
  getToolTargetPresentation,
  getToolSectionIcon,
  TOOL_TOOLTIP_PROPS
} from '../core/tool-display'
import { ToolResultContent } from '../core/ToolResultContent'
import { ToolCallBox } from '../core/ToolCallBox'
import { ToolSummaryHeader } from '../core/ToolSummaryHeader'
import { defineToolRender } from '../defineToolRender'
import { ClaudeEditDiff } from './ClaudeEditDiff'
import { buildClaudeToolPresentation, getClaudeToolBaseName } from './claude-tool-presentation'
import { ClaudeToolInlineFields, renderClaudeBlockField } from './claude-tool-field-sections'
import { getClaudeToolSummaryText } from './claude-tool-summary'

export const GenericClaudeTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const view = useMemo(() => buildClaudeToolPresentation(item.name, item.input), [item.input, item.name])
  const titleText = useMemo(() => t(view.titleKey, { defaultValue: view.fallbackTitle }), [t, view.fallbackTitle, view.titleKey])
  const inlineFields = view.fields.filter(field => field.format === 'inline')
  const isEditTool = view.baseName === 'Edit'
  const blockFields = view.fields.filter((field) => {
    if (field.format === 'inline') return false
    if (!isEditTool) return true
    return field.labelKey !== 'chat.tools.fields.oldString' && field.labelKey !== 'chat.tools.fields.newString'
  })
  const hasFields = view.fields.length > 0
  const hasResultDetails = resultItem != null && hasMeaningfulToolValue(resultItem.content)
  const showResultDetails = hasResultDetails && (!isEditTool || resultItem?.is_error === true)
  const hasDetails = hasFields || hasResultDetails
  const preferMarkdown = ['WebFetch', 'WebSearch'].includes(getClaudeToolBaseName(item.name))
  const editInput = isEditTool && item.input != null && typeof item.input === 'object' && !Array.isArray(item.input)
    ? item.input as Record<string, unknown>
    : null
  const editLanguage = blockFields.find(field => field.lang != null)?.lang
  const editOldValue = typeof editInput?.old_string === 'string' ? editInput.old_string : undefined
  const editNewValue = typeof editInput?.new_string === 'string' ? editInput.new_string : undefined
  const hasEditDiff = isEditTool && (editOldValue != null || editNewValue != null)
  const editMetaItems = hasEditDiff
    ? inlineFields.map((field) => {
      const label = t(field.labelKey, { defaultValue: field.fallbackLabel })
      const isBooleanTrue = field.value === true || field.value === 'true'
      const isBooleanFalse = field.value === false || field.value === 'false'

      return {
        icon: getToolFieldIcon(field.labelKey, field.format),
        label,
        value: isBooleanTrue
          ? t('chat.tools.booleanOn')
          : isBooleanFalse
            ? t('chat.tools.booleanOff')
            : getToolInlineValueText(field.value),
        tone: isBooleanTrue ? 'success' : isBooleanFalse ? 'muted' : 'default'
      } as const
    })
    : []
  const standaloneInlineFields = hasEditDiff ? [] : inlineFields
  const summaryText = useMemo(() => getClaudeToolSummaryText(item.name, item.input, t), [item.input, item.name, t])
  const rawTargetText = view.primary ?? (summaryText !== titleText ? summaryText : undefined)
  const targetPresentation = getToolTargetPresentation(rawTargetText)
  const errorMeta = resultItem?.is_error === true
    ? (
      <span className='claude-generic-tool__status is-error'>
        <span className='material-symbols-rounded'>error</span>
      </span>
    )
    : undefined

  return (
    <div className='tool-group tool-group--compact claude-generic-tool'>
      <ToolCallBox
        variant='inline'
        defaultExpanded={false}
        collapsible={hasDetails}
        header={({ isExpanded, isCollapsible }) => (
          <ToolSummaryHeader
            icon={<span className='material-symbols-rounded'>{view.icon}</span>}
            title={titleText}
            target={targetPresentation.text}
            targetTitle={targetPresentation.title}
            targetMonospace={targetPresentation.monospace}
            expanded={isExpanded}
            collapsible={isCollapsible}
            meta={errorMeta}
            metaTitle={errorMeta == null ? undefined : t('chat.result')}
          />
        )}
        content={hasDetails
          ? (
          <div className='tool-detail-sections claude-generic-tool__content'>
            <ClaudeToolInlineFields fields={standaloneInlineFields} t={t} />
            {hasEditDiff && (
              <div className='tool-detail-section claude-generic-tool__section'>
                <ClaudeEditDiff
                  oldValue={editOldValue}
                  newValue={editNewValue}
                  lang={editLanguage}
                  metaItems={editMetaItems}
                />
              </div>
            )}
            {blockFields.map((field, index) => renderClaudeBlockField(field, index, t))}
            {showResultDetails && resultItem != null && (
              <div className='tool-detail-section'>
                <div className='tool-detail-section__header'>
                  <Tooltip title={t('chat.result')} {...TOOL_TOOLTIP_PROPS}>
                    <span className='tool-detail-section__icon material-symbols-rounded'>
                      {getToolSectionIcon('result')}
                    </span>
                  </Tooltip>
                </div>
                <ToolResultContent content={resultItem.content} preferMarkdown={preferMarkdown} />
              </div>
            )}
          </div>
            )
          : null}
      />
    </div>
  )
})
