import React, { useMemo } from 'react'
import './LsTool.scss'
import type { ChatMessageContent } from '@vibe-forge/core'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'
import { safeJsonStringify } from '../safeSerialize'
import { FileList } from './FileList'

export function LsTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { path?: string; ignore?: string[] }
  const path = (input.path != null && input.path !== '') ? input.path : 'current directory'
  const ignore = input.ignore

  // Helper to determine if we should show the fancy list or raw code block
  const shouldShowList = (content: any) => {
    if (typeof content !== 'string') return false
    // If it looks like a long raw output (e.g. ls -l), maybe keep code block?
    // For now, let's try FileList for everything, assuming the tool returns simple lists.
    // But if it contains many spaces in a line (like ls -l), FileList might look weird.
    // Let's check if lines look like file paths.
    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length > 0 && lines[0].includes('drwxr')) return false // Unix permissions
    return true
  }

  const processContent = (content: string) => {
    // Split lines and filter out empty lines immediately
    const lines = content.split('\n').filter(line => line.trim() !== '')

    // Remove the last line as requested (useless info)
    if (lines.length > 0) {
      lines.pop()
    }
    return lines
  }

  const fileCount = useMemo(() => {
    if (!resultItem) return null
    if (typeof resultItem.content !== 'string') return null
    if (!shouldShowList(resultItem.content)) return null

    const lines = processContent(resultItem.content)
    return lines.length
  }, [resultItem])

  return (
    <div className='tool-group ls-tool'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>folder_open</span>
            <span className='command-name'>LS</span>
            <span className='path'>{path}</span>
            {fileCount !== null && (
              <span className='file-count'>({fileCount} files)</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {ignore && ignore.length > 0 && (
              <div className='input-details'>
                <span className='label'>Ignore:</span>
                <code>{JSON.stringify(ignore)}</code>
              </div>
            )}

            {resultItem
              ? (
                <div className='result-content'>
                  {shouldShowList(resultItem.content)
                    ? (
                      <FileList
                        content={processContent(resultItem.content as string)}
                        removeRoot={true}
                        defaultCollapsed={true}
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
                  Listing files...
                </div>
              )}
          </div>
        }
      />
    </div>
  )
}
