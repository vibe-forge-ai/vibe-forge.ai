import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessageContent } from '@vibe-forge/core'

import { ToolCallBox } from './core/ToolCallBox'
import { ToolDiffViewer } from './core/ToolDiffViewer'
import { ToolResultContent } from './core/ToolResultContent'
import { ToolSummaryHeader } from './core/ToolSummaryHeader'
import { buildGenericToolPresentation } from './core/generic-tool-presentation'
import { hasMeaningfulToolValue } from './core/tool-content-presence'
import { getToolTargetPresentation } from './core/tool-display'
import { ToolInlineFields, renderToolBlockField } from './core/tool-field-sections'
import { getToolPrimaryText, getToolTitleText } from './core/tool-summary'

export function DefaultTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const view = useMemo(() => buildGenericToolPresentation(item.name, item.input), [item.input, item.name])
  const hasCallDetails = view.inlineFields.length > 0 || view.blockFields.length > 0 || view.diff != null
  const hasResultDetails = resultItem != null && hasMeaningfulToolValue(resultItem.content)
  const showResultDetails = hasResultDetails && !(view.suppressSuccessResult === true && resultItem?.is_error !== true)
  const hasDetails = hasCallDetails || showResultDetails
  const titleText = view.titleKey != null
    ? t(view.titleKey, { defaultValue: view.fallbackTitle })
    : getToolTitleText(item, t)
  const targetPresentation = getToolTargetPresentation(view.primary ?? getToolPrimaryText(item))
  const preferMarkdown = ['webfetch', 'websearch'].includes(
    item.name.split(':').pop()?.replace(/[^a-z0-9]+/gi, '').toLowerCase() ?? ''
  )
  const errorMeta = resultItem?.is_error === true
    ? (
      <span className='tool-status tool-status--error'>
        <span className='material-symbols-rounded'>error</span>
      </span>
    )
    : undefined

  return (
    <div className='tool-group tool-group--compact'>
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
            <div className='tool-detail-sections'>
              <ToolInlineFields fields={view.inlineFields} t={t} />
              {view.diff != null && (
                <div className='tool-detail-section'>
                  <ToolDiffViewer
                    original={view.diff.original}
                    modified={view.diff.modified}
                    language={view.diff.language}
                    metaItems={(view.diff.metaItems ?? []).map(item => ({
                      icon: item.icon,
                      label: t(item.labelKey, { defaultValue: item.fallbackLabel }),
                      value: item.value != null && item.value !== ''
                        ? (item.value === 'true'
                          ? t('chat.tools.booleanOn')
                          : item.value === 'false'
                          ? t('chat.tools.booleanOff')
                          : item.value)
                        : undefined,
                      tone: item.tone
                    }))}
                    splitLabel={t('chat.tools.diffSplit')}
                    inlineLabel={t('chat.tools.diffInline')}
                  />
                </div>
              )}
              {view.blockFields.map((field, index) => renderToolBlockField(field, index, t))}
              {showResultDetails && resultItem != null && (
                <div className='tool-detail-section'>
                  <ToolResultContent content={resultItem.content} preferMarkdown={preferMarkdown} />
                </div>
              )}
            </div>
          )
          : null}
      />
    </div>
  )
}
