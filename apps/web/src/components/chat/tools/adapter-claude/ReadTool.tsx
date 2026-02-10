import React from 'react'
import './ReadTool.scss'
import { useTranslation } from 'react-i18next'

import { defineToolRender } from '../defineToolRender'
import { CodeBlock } from '../../CodeBlock'
import { ToolCallBox } from '../../ToolCallBox'
import { safeJsonStringify } from '../../safeSerialize'

export const ReadTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { file_path?: string }
  const filePath = (input.file_path != null && input.file_path !== '') ? input.file_path : 'unknown file'
  const lastPart = filePath.split('/').pop()
  const fileName = (lastPart != null && lastPart !== '') ? lastPart : filePath
  const dirPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''

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

  const cleanContent = (content: any): string => {
    if (typeof content !== 'string') return safeJsonStringify(content, 2)

    return content.split('\n')
      .filter(line => /^\s*\d+→/.test(line))
      .map(line => line.replace(/^\s*\d+→/, ''))
      .join('\n')
  }

  return (
    <div className='tool-group read-tool'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>description</span>
            <span className='command-name'>{t('chat.tools.read')}</span>
            <span className='file-name'>{fileName}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            {dirPath && (
              <div className='file-path'>
                {dirPath}
              </div>
            )}
            {resultItem
              ? (
                <div className='result-content'>
                  <CodeBlock
                    code={cleanContent(resultItem.content)}
                    lang={language}
                  />
                </div>
              )
              : (
                <div className='tool-placeholder'>
                  {t('chat.tools.reading')}
                </div>
              )}
          </div>
        }
      />
    </div>
  )
})
