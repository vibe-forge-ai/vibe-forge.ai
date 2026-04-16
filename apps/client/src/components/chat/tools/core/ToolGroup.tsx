import './ToolGroup.scss'

import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import type { ToolViewEnvelope } from '@vibe-forge/types'
import { buildToolViewId } from '@vibe-forge/tool-view'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { MessageContextMenu } from '../../messages/MessageContextMenu'
import { MessageFooter } from '../../messages/MessageFooter'
import { ToolRenderer } from './ToolRenderer'
import { getToolGroupSummaryText } from './tool-summary'

interface ToolGroupProps {
  anchorId: string
  items: {
    sourceMessageId: string
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }[]
  originalMessage: ChatMessage
  sessionId?: string
  targetToolUseId?: string
  toolViews?: Record<string, ToolViewEnvelope>
  footer?: {
    model?: string
    usage?: ChatMessage['usage']
    createdAt: number
    originalMessage: ChatMessage
  }
}

function ToolGroupComponent({
  anchorId,
  items,
  originalMessage,
  sessionId,
  targetToolUseId,
  toolViews,
  footer
}: ToolGroupProps) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const isDebugMode = searchParams.get('debug') === 'true'
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const summaryText = getToolGroupSummaryText(items, t)
  const shouldForceExpand = targetToolUseId != null &&
    targetToolUseId !== '' &&
    items.some(item => item.item.id === targetToolUseId)
  const isExpanded = expanded || shouldForceExpand

  // If only one item, just render it directly (wrapped in container for footer)
  if (items.length === 1) {
    return (
      <MessageContextMenu
        anchorId={anchorId}
        canEdit={false}
        canFork={false}
        canRecall={false}
        isDebugMode={isDebugMode}
        isEditing={false}
        message={originalMessage}
        sessionId={sessionId}
        onFork={() => {}}
        onRecall={() => {}}
        onStartEditing={() => {}}
      >
        <div id={anchorId} className='tool-group-container'>
          <div className='tool-group-wrapper single-item' data-tool-use-id={items[0].item.id}>
            <ToolRenderer
              item={items[0].item}
              resultItem={items[0].resultItem}
              toolView={toolViews?.[buildToolViewId(items[0].sourceMessageId, items[0].item.id)]}
            />
          </div>
          {footer && isDebugMode && (
            <div className='tool-group-footer-wrapper'>
              <MessageFooter msg={footer.originalMessage} isUser={false} />
            </div>
          )}
        </div>
      </MessageContextMenu>
    )
  }

  return (
    <MessageContextMenu
      anchorId={anchorId}
      canEdit={false}
      canFork={false}
      canRecall={false}
      isDebugMode={isDebugMode}
      isEditing={false}
      message={originalMessage}
      sessionId={sessionId}
      onFork={() => {}}
      onRecall={() => {}}
      onStartEditing={() => {}}
    >
      <div id={anchorId} className='tool-group-container'>
        <div className='tool-group-wrapper card-style'>
          <div
            className='tool-group-header'
            aria-expanded={isExpanded}
            onClick={() => setExpanded(!expanded)}
          >
            <div className='header-left'>
              <span>{summaryText}</span>
            </div>
            <span className={`material-symbols-rounded expand-icon ${isExpanded ? 'is-expanded' : ''}`}>
              chevron_right
            </span>
          </div>

          <div
            className={`tool-group-list-shell ${isExpanded ? 'expanded' : 'collapsed'}`}
            aria-hidden={!isExpanded}
          >
            <div className='tool-group-list'>
              {items.map((it, idx) => (
                <ToolRenderer
                  key={buildToolViewId(it.sourceMessageId, it.item.id) || idx}
                  item={it.item}
                  resultItem={it.resultItem}
                  toolView={toolViews?.[buildToolViewId(it.sourceMessageId, it.item.id)]}
                />
              ))}
            </div>
          </div>
        </div>

        {footer && isDebugMode && (
          <div className='tool-group-footer-wrapper'>
            <MessageFooter msg={footer.originalMessage} isUser={false} />
          </div>
        )}
      </div>
    </MessageContextMenu>
  )
}

const areToolGroupPropsEqual = (prev: ToolGroupProps, next: ToolGroupProps) => {
  if (prev.anchorId !== next.anchorId) return false
  if (prev.items.length !== next.items.length) return false
  if (prev.targetToolUseId !== next.targetToolUseId) return false
  if (prev.toolViews !== next.toolViews) return false
  for (let i = 0; i < prev.items.length; i++) {
    if (prev.items[i].item !== next.items[i].item) return false
    if (prev.items[i].resultItem !== next.items[i].resultItem) return false
  }
  if (prev.originalMessage !== next.originalMessage) return false
  if (prev.sessionId !== next.sessionId) return false
  if (prev.footer == null && next.footer == null) return true
  if (prev.footer == null || next.footer == null) return false
  return prev.footer.originalMessage === next.footer.originalMessage &&
    prev.footer.createdAt === next.footer.createdAt &&
    prev.footer.model === next.footer.model &&
    prev.footer.usage === next.footer.usage
}

export const ToolGroup = React.memo(ToolGroupComponent, areToolGroupPropsEqual)
