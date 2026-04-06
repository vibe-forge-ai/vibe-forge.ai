import './ToolGroup.scss'

import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { MessageFooter } from '../../messages/MessageFooter'
import { ToolRenderer } from './ToolRenderer'

interface ToolGroupProps {
  items: {
    item: Extract<ChatMessageContent, { type: 'tool_use' }>
    resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
  }[]
  footer?: {
    model?: string
    usage?: ChatMessage['usage']
    createdAt: number
    originalMessage: ChatMessage
  }
}

function ToolGroupComponent({
  items,
  footer
}: ToolGroupProps) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const isDebugMode = searchParams.get('debug') === 'true'
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  // If only one item, just render it directly (wrapped in container for footer)
  if (items.length === 1) {
    return (
      <div className='tool-group-container'>
        <div className='tool-group-wrapper single-item'>
          <ToolRenderer
            item={items[0].item}
            resultItem={items[0].resultItem}
          />
        </div>
        {footer && isDebugMode && (
          <div className='tool-group-footer-wrapper'>
            <MessageFooter msg={footer.originalMessage} isUser={false} />
          </div>
        )}
      </div>
    )
  }

  const lastItem = items[items.length - 1]
  const otherItems = items.slice(0, -1)

  return (
    <div className='tool-group-container'>
      <div className='tool-group-wrapper card-style'>
        <div
          className='tool-group-header'
          onClick={() => setExpanded(!expanded)}
        >
          <div className='header-left'>
            <span className='material-symbols-rounded'>dataset</span>
            <span>{t('chat.usedTools', { count: items.length })}</span>
          </div>
          <span className='material-symbols-rounded expand-icon'>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>

        {expanded && (
          <div className='tool-group-list'>
            {otherItems.map((it, idx) => (
              <ToolRenderer
                key={it.item.id || idx}
                item={it.item}
                resultItem={it.resultItem}
              />
            ))}
          </div>
        )}

        {
          /* Always show the last item, but if expanded, it's just part of the list visually.
            If collapsed, it appears "below" the header.
            Actually, to make it look like "part of the list", we should just put it in the flow.

            When collapsed: Header + Last Item
            When expanded: Header + Other Items + Last Item
        */
        }
        <div className='tool-group-last-item'>
          <ToolRenderer
            item={lastItem.item}
            resultItem={lastItem.resultItem}
          />
        </div>
      </div>

      {footer && isDebugMode && (
        <div className='tool-group-footer-wrapper'>
          <MessageFooter msg={footer.originalMessage} isUser={false} />
        </div>
      )}
    </div>
  )
}

const areToolGroupPropsEqual = (prev: ToolGroupProps, next: ToolGroupProps) => {
  if (prev.items.length !== next.items.length) return false
  for (let i = 0; i < prev.items.length; i++) {
    if (prev.items[i].item !== next.items[i].item) return false
    if (prev.items[i].resultItem !== next.items[i].resultItem) return false
  }
  if (prev.footer == null && next.footer == null) return true
  if (prev.footer == null || next.footer == null) return false
  return prev.footer.originalMessage === next.footer.originalMessage &&
    prev.footer.createdAt === next.footer.createdAt &&
    prev.footer.model === next.footer.model &&
    prev.footer.usage === next.footer.usage
}

export const ToolGroup = React.memo(ToolGroupComponent, areToolGroupPropsEqual)
