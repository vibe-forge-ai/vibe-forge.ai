import React, { useMemo } from 'react'
import './GlobTool.scss'
import { useTranslation } from 'react-i18next'

import { defineToolRender } from '../defineToolRender'
import { ToolCallBox } from '../../ToolCallBox'
import { safeJsonStringify } from '../../safeSerialize'
import { FileList } from './components/FileList'

export const GlobTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { pattern?: string; path?: string }
  const pattern = (input.pattern != null && input.pattern !== '') ? input.pattern : '*'
  const path = input.path

  const fileCount = useMemo(() => {
    if (!resultItem) return null
    const content = resultItem.content
    let lines: string[] = []

    if (typeof content === 'string') {
      if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            lines = parsed.map(String)
          } else {
            lines = content.split('\n')
          }
        } catch (e) {
          lines = content.split('\n')
        }
      } else {
        lines = content.split('\n')
      }
    } else if (Array.isArray(content)) {
      lines = content.map(String)
    }

    const count = lines.filter(line => line.trim() !== '').length
    return count
  }, [resultItem])

  return (
    <div className='tool-group glob-tool'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>search</span>
            <span className='command-name'>Glob</span>
            <span className='pattern'>{pattern}</span>
            {fileCount !== null && (
              <span className='file-count'>({fileCount} files)</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {path && (
              <div className='input-details'>
                <span className='label'>Path:</span>
                <span className='value'>{path}</span>
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
