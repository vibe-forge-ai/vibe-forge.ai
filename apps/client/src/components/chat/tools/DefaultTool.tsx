import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ChatMessageContent } from '@vibe-forge/core'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'

import { ToolCallBox } from './core/ToolCallBox'
import { hasMeaningfulToolValue } from './core/tool-content-presence'
import {
  getToolTargetPresentation,
  getToolSectionIcon,
  TOOL_TOOLTIP_PROPS
} from './core/tool-display'
import { ToolResultContent } from './core/ToolResultContent'
import { ToolSummaryHeader } from './core/ToolSummaryHeader'
import { getToolPrimaryText, getToolTitleText } from './core/tool-summary'

export function DefaultTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const hasCallDetails = hasMeaningfulToolValue(item.input)
  const hasResultDetails = resultItem != null && hasMeaningfulToolValue(resultItem.content)
  const hasDetails = hasCallDetails || hasResultDetails
  const titleText = getToolTitleText(item, t)
  const targetPresentation = getToolTargetPresentation(getToolPrimaryText(item))
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
            icon={<span className='material-symbols-rounded'>build</span>}
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
            {hasCallDetails && (
              <div className='tool-detail-section'>
                <div className='tool-detail-section__header'>
                  <Tooltip title={t('chat.tools.call')} {...TOOL_TOOLTIP_PROPS}>
                    <span className='tool-detail-section__icon material-symbols-rounded'>
                      {getToolSectionIcon('call')}
                    </span>
                  </Tooltip>
                </div>
                <CodeBlock
                  code={safeJsonStringify(item.input != null ? item.input : {}, 2)}
                  lang='json'
                  hideHeader={true}
                />
              </div>
            )}
            {hasResultDetails && resultItem != null && (
              <div className='tool-detail-section'>
                <div className='tool-detail-section__header'>
                  <Tooltip title={t('chat.result')} {...TOOL_TOOLTIP_PROPS}>
                    <span className='tool-detail-section__icon material-symbols-rounded'>
                      {getToolSectionIcon('result')}
                    </span>
                  </Tooltip>
                </div>
                <ToolResultContent content={resultItem.content} />
              </div>
            )}
          </div>
            )
          : null}
      />
    </div>
  )
}
