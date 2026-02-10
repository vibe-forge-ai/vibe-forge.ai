import React from 'react'
import './ReadTool.scss'
import type { ChatMessageContent } from '@vibe-forge/core'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'
import { safeJsonStringify } from '../safeSerialize'

export function ReadTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { file_path?: string }
  const filePath = (input.file_path != null && input.file_path !== '') ? input.file_path : 'unknown file'
  const lastPart = filePath.split('/').pop()
  const fileName = (lastPart != null && lastPart !== '') ? lastPart : filePath
  const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''

  // Get language from file extension
  const getLanguage = (path: string) => {
    const extPart = path.split('.').pop()
    const ext = (extPart != null && extPart !== '') ? extPart.toLowerCase() : ''
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
    return langMap[ext] || 'text'
  }

  const language = getLanguage(filePath)

  // Clean content by removing line numbers and markers
  const cleanContent = (content: any): string => {
    if (typeof content !== 'string') return safeJsonStringify(content, 2)

    // Only keep lines that start with the line number pattern (e.g., "  1→")
    // This effectively removes <system-reminder> blocks and any surrounding whitespace
    return content.split('\n')
      .filter(line => /^\s*\d+→/.test(line))
      .map(line => line.replace(/^\s*\d+→/, ''))
      .join('\n')
  }

  return (
    <div className='tool-group read-tool'>
      <ToolCallBox
        defaultExpanded={false}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>visibility</span>
            <span className='file-name'>{fileName}</span>
            {(dirPath != null && dirPath !== '') && <span className='file-path'>{dirPath}</span>}
          </div>
        }
        content={
          <div className='tool-content'>
            {resultItem
              ? (
                <div className='bash-content-scroll'>
                  <div className='bash-code-wrapper'>
                    <CodeBlock
                      code={cleanContent(resultItem.content)}
                      lang={language}
                      showLineNumbers={true}
                    />
                  </div>
                </div>
              )
              : (
                <div className='reading-placeholder'>
                  {t('chat.tools.reading')}
                </div>
              )}
          </div>
        }
      />
    </div>
  )
}
