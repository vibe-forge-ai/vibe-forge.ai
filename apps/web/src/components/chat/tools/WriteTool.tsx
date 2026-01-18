import React from 'react'
import './WriteTool.scss'
import type { ChatMessageContent } from '#~/types'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'

export function WriteTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input || {}) as { file_path?: string; content?: string }
  const filePath = input.file_path || 'unknown file'
  const fileName = filePath.split('/').pop() || filePath
  const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
  const content = input.content || ''

  // Get language from file extension
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'md': 'markdown',
      'json': 'json',
      'scss': 'scss',
      'css': 'css',
      'html': 'html',
      'sh': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sql': 'sql'
    }
    return langMap[ext || ''] || 'text'
  }

  const language = getLanguage(filePath)

  return (
    <div className='tool-group write-tool'>
      <ToolCallBox
        defaultExpanded={false}
        onDoubleClick={resultItem ? () => console.log('🛠️ Tool Result (Write):', resultItem) : undefined}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-outlined'>edit_note</span>
            <span className='file-name'>{fileName}</span>
            {dirPath && <span className='file-path'>{dirPath}</span>}
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='bash-content-scroll'>
              <div className='bash-code-wrapper'>
                <CodeBlock
                  code={content}
                  lang={language}
                  showLineNumbers={true}
                />
              </div>
            </div>
          </div>
        }
      />
      {resultItem && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          onDoubleClick={() => console.log('🛠️ Tool Result (Write):', resultItem)}
          header={
            <div className='write-result-status'>
              <span
                className='material-symbols-outlined'
                style={{
                  fontSize: 14,
                  color: resultItem.is_error ? '#ef4444' : '#10b981'
                }}
              >
                {resultItem.is_error ? 'error' : 'check_circle'}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: resultItem.is_error ? '#ef4444' : '#059669'
                }}
              >
                {resultItem.is_error ? t('chat.tools.writeFailed') : t('chat.tools.writeSuccess')}
              </span>
            </div>
          }
          content={null}
        />
      )}
    </div>
  )
}
