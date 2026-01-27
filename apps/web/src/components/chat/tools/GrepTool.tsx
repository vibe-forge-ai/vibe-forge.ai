import React, { useMemo } from 'react'
import './GrepTool.scss'
import type { ChatMessageContent } from '@vibe-forge/core'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'
import { FileList } from './FileList'

export function GrepTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { pattern?: string; path?: string; output_mode?: string; glob?: string }
  const pattern = (input.pattern != null && input.pattern !== '') ? input.pattern : ''
  const path = input.path
  const outputMode = input.output_mode || 'files_with_matches'
  const fileGlob = input.glob

  const fileCount = useMemo(() => {
    if (!resultItem) return null;
    const content = resultItem.content;
    let lines: string[] = [];
    
    if (typeof content === 'string') {
         // Try to parse if it looks like JSON
        if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    lines = parsed.map(String);
                } else {
                    lines = content.split('\n');
                }
            } catch (e) {
                 lines = content.split('\n');
            }
        } else {
             lines = content.split('\n');
        }
    } else if (Array.isArray(content)) {
        lines = content.map(String);
    }

    // Filter empty lines
    const count = lines.filter(line => line.trim() !== '').length;
    return count;
  }, [resultItem]);

  return (
    <div className='tool-group grep-tool'>
       <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded'>find_in_page</span>
            <span className='command-name'>Grep</span>
            <span className='pattern'>{pattern}</span>
            {fileCount !== null && (
                <span className='file-count'>({fileCount} matches)</span>
            )}
          </div>
        }
        content={
             <div className='tool-content'>
                 {(path || fileGlob) && (
                     <div className="input-details-grid">
                        {path && (
                            <div className="input-detail-item">
                                <span className="label">Path:</span>
                                <span className="value">{path}</span>
                            </div>
                        )}
                        {fileGlob && (
                            <div className="input-detail-item">
                                <span className="label">Glob:</span>
                                <span className="value">{fileGlob}</span>
                            </div>
                        )}
                     </div>
                 )}
                {resultItem ? (
                    <div className='result-content'>
                        {outputMode === 'files_with_matches' ? (
                            <FileList content={typeof resultItem.content === 'string' ? resultItem.content : JSON.stringify(resultItem.content)} />
                        ) : (
                             <CodeBlock
                                code={typeof resultItem.content === 'string' ? resultItem.content : JSON.stringify(resultItem.content, null, 2)}
                                lang='text'
                              />
                        )}
                    </div>
                ) : (
                    <div className="tool-placeholder">
                        Searching...
                    </div>
                )}
            </div>
        }
      />
    </div>
  )
}
