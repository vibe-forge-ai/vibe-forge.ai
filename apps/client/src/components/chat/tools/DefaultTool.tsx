import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { MarkdownContent } from '../MarkdownContent'
import { ToolCallBox } from '../ToolCallBox'
import { safeJsonStringify } from '../safeSerialize'

export function DefaultTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  return (
    <div className='tool-group'>
      <ToolCallBox
        header={
          <>
            <span className='material-symbols-rounded' style={{ fontSize: 16 }}>build</span>
            <span>{item.name}</span>
            <span style={{ color: 'var(--sub-text-color)', fontSize: 11, fontWeight: 400 }}>
              {t('chat.tools.call')}
            </span>
          </>
        }
        content={
          <div className='tool-content'>
            <CodeBlock
              code={safeJsonStringify(item.input != null ? item.input : {}, 2)}
              lang='json'
            />
          </div>
        }
      />
      {resultItem != null && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          header={
            <>
              <span className='material-symbols-rounded' style={{ fontSize: 16 }}>
                {resultItem.is_error === true ? 'error' : 'check_circle'}
              </span>
              <span>{t('chat.result')}</span>
            </>
          }
          content={
            <div className='tool-content'>
              {typeof resultItem.content === 'string'
                ? (resultItem.content.startsWith('```')
                  ? <MarkdownContent content={resultItem.content} />
                  : <CodeBlock code={resultItem.content} lang='text' />)
                : <CodeBlock code={safeJsonStringify(resultItem.content, 2)} lang='json' />}
            </div>
          }
        />
      )}
    </div>
  )
}
