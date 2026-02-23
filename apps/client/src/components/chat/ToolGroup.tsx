import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageFooter } from './MessageFooter'
import './ToolGroup.scss'
import { ToolRenderer } from './ToolRenderer'

export function ToolGroup({
  items,
  footer
}: {
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
}) {
  const { t } = useTranslation()
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
        {footer && (
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

      {footer && (
        <div className='tool-group-footer-wrapper'>
          <MessageFooter msg={footer.originalMessage} isUser={false} />
        </div>
      )}
    </div>
  )
}
