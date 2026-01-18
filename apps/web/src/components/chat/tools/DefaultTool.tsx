import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'

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
            <span className='material-symbols-outlined' style={{ fontSize: 16 }}>build</span>
            <span>{item.name}</span>
            <span style={{ color: '#9ca3af', fontSize: 11, fontWeight: 400 }}>{t('chat.tools.call')}</span>
          </>
        }
        content={
          <div className='tool-content'>
            <CodeBlock
              code={JSON.stringify(item.input || {}, null, 2)}
              lang='json'
            />
          </div>
        }
      />
      {resultItem && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          onDoubleClick={() => console.log(`🛠️ Tool Result (${item.name}):`, resultItem)}
          header={
            <>
              <span className='material-symbols-outlined' style={{ fontSize: 16 }}>
                {resultItem.is_error ? 'error' : 'check_circle'}
              </span>
              <span>{t('chat.result')}</span>
            </>
          }
          content={
            <div className='tool-content'>
              {typeof resultItem.content === 'string'
                ? (resultItem.content.startsWith('```')
                  ? <div className='markdown-body'>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultItem.content}</ReactMarkdown>
                  </div>
                  : <CodeBlock code={resultItem.content} lang='text' />)
                : <CodeBlock code={JSON.stringify(resultItem.content, null, 2)} lang='json' />}
            </div>
          }
        />
      )}
    </div>
  )
}
