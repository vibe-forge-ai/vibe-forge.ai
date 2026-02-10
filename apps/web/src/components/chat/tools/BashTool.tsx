import './BashTool.scss'
import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'
import { safeJsonStringify } from '../safeSerialize'

export function BashTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as {
    command?: string
    reason?: string
    thought?: string
    description?: string
  }
  const command = input.command ?? ''
  const reason = (input.description != null && input.description !== '')
    ? input.description
    : (input.reason != null && input.reason !== '')
    ? input.reason
    : (input.thought != null && input.thought !== '')
    ? input.thought
    : ''

  return (
    <div className='tool-group bash-tool'>
      <ToolCallBox
        collapsible={false}
        header={
          <div className='bash-header'>
            <span className='material-symbols-rounded status-icon'>terminal</span>
            <span className='bash-title'>{t('chat.tools.bash')}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            {(reason != null && reason !== '') && (
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

      {resultItem != null && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          header={
            <div className='result-header'>
              <span className='material-symbols-rounded status-icon'>
                {resultItem.is_error === true ? 'error' : 'check_circle'}
              </span>
              <span className='result-title'>{t('chat.result')}</span>
            </div>
          }
          content={
            <div className='tool-content'>
              <div className='bash-content-scroll'>
                <div className='bash-code-wrapper'>
                  {typeof resultItem.content === 'string'
                    ? <CodeBlock code={resultItem.content} lang='text' />
                    : <CodeBlock code={safeJsonStringify(resultItem.content, 2)} lang='json' />}
                </div>
              </div>
            </div>
          }
        />
      )}
    </div>
  )
}
