import './GrepTool.scss'
import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'
import React, { useMemo } from 'react'
import { ToolCallBox } from '../core/ToolCallBox'
import { defineToolRender } from '../defineToolRender'
import { FileList } from './components/FileList'
import { normalizeResultLines } from './utils'

export const GrepTool = defineToolRender(({ item, resultItem }) => {
  const input = (item.input != null ? item.input : {}) as {
    pattern?: string
    path?: string
    output_mode?: string
    glob?: string
  }
  const pattern = (input.pattern != null && input.pattern !== '') ? input.pattern : ''
  const path = input.path
  const outputMode = input.output_mode || 'files_with_matches'
  const fileGlob = input.glob

  const fileCount = useMemo(() => {
    if (!resultItem) return null
    const lines = normalizeResultLines(resultItem.content)
    const count = lines.filter(line => line.trim() !== '').length
    return count
  }, [resultItem])

  return (
    <div className='tool-group grep-tool'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>find_in_page</span>
            <span className='tool-header-title'>Grep</span>
            <span className='tool-header-secondary'>{pattern}</span>
            {fileCount !== null && (
              <span className='tool-header-chip'>{fileCount} matches</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {(path || fileGlob || outputMode) && (
              <div className='tool-input-grid'>
                {path && (
                  <div className='tool-input-item'>
                    <span className='tool-input-label'>Path</span>
                    <span className='tool-input-value'>{path}</span>
                  </div>
                )}
                {fileGlob && (
                  <div className='tool-input-item'>
                    <span className='tool-input-label'>Glob</span>
                    <span className='tool-input-value'>{fileGlob}</span>
                  </div>
                )}
                <div className='tool-input-item'>
                  <span className='tool-input-label'>Mode</span>
                  <span className='tool-input-value'>{outputMode}</span>
                </div>
              </div>
            )}
            {resultItem
              ? (
                <div className='result-content'>
                  {outputMode === 'files_with_matches'
                    ? (
                      <FileList
                        content={typeof resultItem.content === 'string'
                          ? resultItem.content
                          : safeJsonStringify(resultItem.content)}
                      />
                    )
                    : (
                      <CodeBlock
                        code={typeof resultItem.content === 'string'
                          ? resultItem.content
                          : safeJsonStringify(resultItem.content, 2)}
                        lang='text'
                      />
                    )}
                </div>
              )
              : (
                <div className='tool-placeholder'>
                  Searching...
                </div>
              )}
          </div>
        }
      />
    </div>
  )
})
