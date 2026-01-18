import './BashTool.scss'
import type { ChatMessageContent } from '#~/types'
import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'

export function BashTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input || {}) as { command?: string; reason?: string; thought?: string; description?: string }
  const command = input.command || ''
  const reason = input.description || input.reason || input.thought || ''

  return (
    <div className='tool-group bash-tool'>
      <ToolCallBox
        collapsible={false}
        header={
          <>
            <span className='material-symbols-outlined' style={{ fontSize: 16 }}>terminal</span>
            <span style={{ fontWeight: 600 }}>{t('chat.tools.bash')}</span>
          </>
        }
        content={
          <div className='tool-content'>
            {reason && (
              <div className='tool-reason markdown-body'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reason}</ReactMarkdown>
              </div>
            )}
            <div className='bash-content-scroll'>
              <div className='bash-code-wrapper'>
                <CodeBlock code={command} lang='shell' />
              </div>
            </div>
          </div>
        }
      />

      {resultItem && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          onDoubleClick={() => console.log('🛠️ Tool Result (Bash):', resultItem)}
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
              <div className='bash-content-scroll'>
                <div className='bash-code-wrapper'>
                  {typeof resultItem.content === 'string'
                    ? <CodeBlock code={resultItem.content} lang='text' />
                    : <CodeBlock code={JSON.stringify(resultItem.content, null, 2)} lang='json' />}
                </div>
              </div>
            </div>
          }
        />
      )}
    </div>
  )
}
