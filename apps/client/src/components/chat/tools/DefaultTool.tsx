import type { ChatMessageContent } from '@vibe-forge/core'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../CodeBlock'
import { MarkdownContent } from '../MarkdownContent'
import { ToolCallBox } from '../ToolCallBox'
import { safeJsonStringify, toSerializable } from '../safeSerialize'

interface StructuredTextBlock {
  type: 'text'
  text: string
  format: 'text' | 'markdown'
}

interface StructuredImageBlock {
  type: 'image'
  src: string
  alt?: string
  title?: string
  width?: number
  height?: number
}

type StructuredBlock = StructuredTextBlock | StructuredImageBlock

function parseStructuredInput(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

function resolveImageSource(value: Record<string, unknown>) {
  const directUrl = typeof value.url === 'string'
    ? value.url
    : typeof value.src === 'string'
    ? value.src
    : typeof value.image_url === 'string'
    ? value.image_url
    : typeof value.imageUrl === 'string'
    ? value.imageUrl
    : typeof value.dataUrl === 'string'
    ? value.dataUrl
    : null
  if (directUrl) {
    return directUrl
  }
  const source = value.source != null && typeof value.source === 'object'
    ? (value.source as Record<string, unknown>)
    : null
  const data = typeof value.data === 'string'
    ? value.data
    : typeof value.base64 === 'string'
    ? value.base64
    : source != null && typeof source.data === 'string'
    ? source.data
    : null
  if (!data) {
    return null
  }
  const mimeType = typeof value.mimeType === 'string'
    ? value.mimeType
    : typeof value.mime_type === 'string'
    ? value.mime_type
    : source != null && typeof source.media_type === 'string'
    ? source.media_type
    : source != null && typeof source.mimeType === 'string'
    ? source.mimeType
    : source != null && typeof source.mime_type === 'string'
    ? source.mime_type
    : 'image/png'
  return `data:${mimeType};base64,${data}`
}

function parseBlock(value: unknown): StructuredBlock | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const obj = value as Record<string, unknown>
  const rawType = typeof obj.type === 'string' ? obj.type.toLowerCase() : ''
  if (rawType === 'text' || rawType === 'markdown' || rawType === 'md') {
    const text = typeof obj.text === 'string'
      ? obj.text
      : typeof obj.content === 'string'
      ? obj.content
      : null
    if (text == null) {
      return null
    }
    const rawFormat = typeof obj.format === 'string' ? obj.format.toLowerCase() : 'markdown'
    const format = rawType === 'text'
      ? (rawFormat === 'text' || rawFormat === 'plain' ? 'text' : 'markdown')
      : 'markdown'
    return { type: 'text', text, format }
  }
  if (rawType === 'image') {
    const src = resolveImageSource(obj)
    if (!src) {
      return null
    }
    const alt = typeof obj.alt === 'string' ? obj.alt : undefined
    const title = typeof obj.title === 'string' ? obj.title : undefined
    const width = typeof obj.width === 'number' ? obj.width : undefined
    const height = typeof obj.height === 'number' ? obj.height : undefined
    return { type: 'image', src, alt, title, width, height }
  }
  return null
}

function getStructuredBlocks(value: unknown): StructuredBlock[] | null {
  const serializable = toSerializable(value)
  const parsed = parseStructuredInput(serializable)
  if (Array.isArray(parsed)) {
    const blocks = parsed.map(parseBlock)
    return blocks.every(Boolean) ? (blocks as StructuredBlock[]) : null
  }
  if (parsed != null && typeof parsed === 'object') {
    const container = parsed as Record<string, unknown>
    const content = container.content ?? container.items ?? container.blocks
    if (Array.isArray(content)) {
      const blocks = content.map(parseBlock)
      return blocks.every(Boolean) ? (blocks as StructuredBlock[]) : null
    }
  }
  const single = parseBlock(parsed)
  return single ? [single] : null
}

function StructuredToolResult({ blocks }: { blocks: StructuredBlock[] }) {
  return (
    <div className='tool-result-structured'>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <div className='tool-result-text' key={`text-${index}`}>
              {block.format === 'markdown'
                ? <MarkdownContent content={block.text} />
                : <div className='tool-result-text-content'>{block.text}</div>}
            </div>
          )
        }
        return (
          <div className='tool-result-image-wrapper' key={`image-${index}`}>
            <img
              className='tool-result-image'
              src={block.src}
              alt={block.alt ?? ''}
              width={block.width}
              height={block.height}
            />
            {block.title != null && block.title.length > 0 && (
              <div className='tool-result-image-caption'>{block.title}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DefaultTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const structuredBlocks = resultItem != null ? getStructuredBlocks(resultItem.content) : null
  return (
    <div className='tool-group'>
      <ToolCallBox
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>build</span>
            <span className='tool-header-title'>{item.name}</span>
            <span className='tool-header-hint'>{t('chat.tools.call')}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <CodeBlock
              code={safeJsonStringify(item.input != null ? item.input : {}, 2)}
              lang='json'
            />
          </div>
        }
      />
      {resultItem != null && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          header={
            <div className='tool-header-content'>
              <span className='material-symbols-rounded tool-header-icon'>
                {resultItem.is_error === true ? 'error' : 'check_circle'}
              </span>
              <span className='tool-header-title'>{t('chat.result')}</span>
            </div>
          }
          content={
            <div className='tool-content'>
              {structuredBlocks != null
                ? <StructuredToolResult blocks={structuredBlocks} />
                : (typeof resultItem.content === 'string'
                  ? (resultItem.content.startsWith('```')
                    ? <MarkdownContent content={resultItem.content} />
                    : <CodeBlock code={resultItem.content} lang='text' />)
                  : <CodeBlock code={safeJsonStringify(resultItem.content, 2)} lang='json' />)}
            </div>
          }
        />
      )}
    </div>
  )
}
