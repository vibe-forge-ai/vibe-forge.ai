import './WriteTool.scss'
import { CodeBlock } from '#~/components/CodeBlock'
import React from 'react'
import { ToolCallBox } from '../core/ToolCallBox'
import { defineToolRender } from '../defineToolRender'
import type { ClaudeWriteToolInput } from './claude-tool-inputs'
import { getFileInfo, getLanguageFromPath } from './utils'

export const WriteTool = defineToolRender(({ item, resultItem }) => {
  const input = (item.input != null ? item.input : {}) as ClaudeWriteToolInput
  const { filePath } = getFileInfo(input.file_path)
  const content = input.content ?? ''
  const language = getLanguageFromPath(filePath)

  return (
    <div className='tool-group write-tool'>
      <ToolCallBox
        defaultExpanded={false}
        header={
          <div className='write-tool__header'>
            <div className='write-tool__header-left'>
              <span className='material-symbols-rounded tool-header-icon'>edit_note</span>
              <span className='tool-header-primary tool-header-mono tool-header-row-text'>{filePath}</span>
            </div>
            {resultItem != null && (
              <span className={`write-tool__status-icon ${resultItem.is_error ? 'error' : 'success'}`}>
                <span className='material-symbols-rounded'>
                  {resultItem.is_error === true ? 'error' : 'check_circle'}
                </span>
              </span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='tool-scroll'>
              <div className='tool-code-wrapper'>
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
    </div>
  )
})
