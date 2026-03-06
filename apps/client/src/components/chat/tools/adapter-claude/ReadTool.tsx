import './ReadTool.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolInputs } from '@vibe-forge/core'
import { CodeBlock } from '../../CodeBlock'
import { ToolCallBox } from '../../ToolCallBox'
import { safeJsonStringify } from '../../safeSerialize'
import { defineToolRender } from '../defineToolRender'
import { getFileInfo, getLanguageFromPath } from './utils'

export const ReadTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as ToolInputs['adapter:claude-code:Read']
  const { filePath } = getFileInfo(input.file_path)
  const language = getLanguageFromPath(filePath)
  const offset = input.offset
  const limit = input.limit

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
            <span className='material-symbols-rounded tool-header-icon'>visibility</span>
            <span className='tool-header-primary tool-header-mono tool-header-row-text'>{filePath}</span>
            {(typeof offset === 'number' && Number.isFinite(offset)) && (
              <span className='tool-header-chip'>{t('chat.tools.offset')}:{offset}</span>
            )}
            {(typeof limit === 'number' && Number.isFinite(limit)) && (
              <span className='tool-header-chip'>{t('chat.tools.limit')}:{limit}</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {resultItem
              ? (
                <div className='result-content'>
                  <CodeBlock
                    code={cleanContent(resultItem.content)}
                    lang={language}
                    hideHeader={true}
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
