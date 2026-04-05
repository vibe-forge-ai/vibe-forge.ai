import type { AdapterMessageContent } from '@vibe-forge/types'

import type { ClaudeCodeContent } from './types'

export const prefixToolName = (name: string) => (
  name.startsWith('adapter:claude-code:') ? name : `adapter:claude-code:${name}`
)

const parseDataUrl = (dataUrl: string) => {
  if (!dataUrl.startsWith('data:')) return null
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return null
  const meta = dataUrl.slice('data:'.length, commaIndex)
  const data = dataUrl.slice(commaIndex + 1)
  const parts = meta.split(';').filter(p => p.trim() !== '')
  const mediaType = parts[0] ?? ''
  const isBase64 = parts.includes('base64')
  if (!isBase64) return null
  if (mediaType.trim() === '') return null
  if (data.trim() === '') return null
  return { mediaType, data }
}

export const mapAdapterContentToClaudeContent = (content: AdapterMessageContent[]): ClaudeCodeContent[] =>
  content.map((item) => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text }
    }
    if (item.type === 'tool_use') {
      const name = item.name.startsWith('adapter:claude-code:')
        ? item.name.replace('adapter:claude-code:', '')
        : item.name
      return { type: 'tool_use', id: item.id, name, input: item.input as any }
    }
    if (item.type === 'tool_result') {
      return {
        type: 'tool_result',
        tool_use_id: item.tool_use_id,
        content: item.content as any,
        is_error: item.is_error
      }
    }
    if (item.type === 'image') {
      const parsed = parseDataUrl(item.url)
      if (parsed != null) {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: item.mimeType ?? parsed.mediaType,
            data: parsed.data
          }
        }
      }
      return { type: 'text', text: `[Image] ${item.url}` }
    }
    if (item.type === 'file') {
      return { type: 'text', text: `Context file: ${item.path}` }
    }
    return { type: 'text', text: '' }
  })
