import './GlobTool.scss'
import { safeJsonStringify } from '#~/utils/safe-serialize'
import React, { useMemo } from 'react'
import { ToolCallBox } from '../core/ToolCallBox'
import { defineToolRender } from '../defineToolRender'
import type { ClaudeGlobToolInput } from './claude-tool-inputs'
import { FileList } from './components/FileList'
import { normalizeResultLines } from './utils'

export const GlobTool = defineToolRender(({ item, resultItem }) => {
  const input = (item.input != null ? item.input : {}) as ClaudeGlobToolInput
  const pattern = (input.pattern != null && input.pattern !== '') ? input.pattern : '*'
  const path = input.path

  const fileCount = useMemo(() => {
    if (!resultItem) return null
    const lines = normalizeResultLines(resultItem.content)
    const count = lines.filter(line => line.trim() !== '').length
    return count
  }, [resultItem])

  return (
    <div className='tool-group glob-tool'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>search</span>
            <span className='tool-header-title'>Glob</span>
            <span className='tool-header-secondary'>{pattern}</span>
            {fileCount !== null && (
              <span className='tool-header-chip'>{fileCount} files</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {path && (
              <div className='tool-input-grid'>
                <div className='tool-input-item'>
                  <span className='tool-input-label'>Path</span>
                  <span className='tool-input-value'>{path}</span>
                </div>
              </div>
            )}
            {resultItem
              ? (
                <div className='result-content'>
                  <FileList
                    content={typeof resultItem.content === 'string'
                      ? resultItem.content
                      : safeJsonStringify(resultItem.content)}
                  />
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
