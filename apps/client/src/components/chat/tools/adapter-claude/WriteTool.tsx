import React from 'react'
import './WriteTool.scss'
import { useTranslation } from 'react-i18next'

import { defineToolRender } from '../defineToolRender'
import { CodeBlock } from '../../CodeBlock'
import { ToolCallBox } from '../../ToolCallBox'

export const WriteTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { file_path?: string; content?: string }
  const filePath = (input.file_path != null && input.file_path !== '') ? input.file_path : 'unknown file'
  const lastPart = filePath.split('/').pop()
  const fileName = (lastPart != null && lastPart !== '') ? lastPart : filePath
  const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
  const content = input.content ?? ''

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

  return (
    <div className='tool-group write-tool'>
      <ToolCallBox
        defaultExpanded={false}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>edit_note</span>
            <span className='file-name'>{fileName}</span>
            {(dirPath != null && dirPath !== '') && <span className='file-path'>{dirPath}</span>}
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
      {resultItem != null && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          header={
            <div className={`write-result-status ${resultItem.is_error ? 'error' : 'success'}`}>
              <span className='material-symbols-rounded status-icon'>
                {resultItem.is_error === true ? 'error' : 'check_circle'}
              </span>
              <span className='status-text'>
                {resultItem.is_error === true ? t('chat.tools.writeFailed') : t('chat.tools.writeSuccess')}
              </span>
            </div>
          }
          content={null}
        />
      )}
    </div>
  )
})
