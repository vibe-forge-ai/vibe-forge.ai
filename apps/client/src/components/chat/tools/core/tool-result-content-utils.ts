import { toSerializable } from '#~/utils/safe-serialize'

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

export type StructuredBlock = StructuredTextBlock | StructuredImageBlock

const parseStructuredInput = (value: unknown) => {
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

const resolveImageSource = (value: Record<string, unknown>) => {
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
  if (directUrl != null) {
    return directUrl
  }

  const source = value.source != null && typeof value.source === 'object'
    ? value.source as Record<string, unknown>
    : null
  const data = typeof value.data === 'string'
    ? value.data
    : typeof value.base64 === 'string'
    ? value.base64
    : source != null && typeof source.data === 'string'
    ? source.data
    : null
  if (data == null || data === '') {
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

const parseBlock = (value: unknown): StructuredBlock | null => {
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
    return {
      type: 'text',
      text,
      format: rawType === 'text' && (rawFormat === 'text' || rawFormat === 'plain') ? 'text' : 'markdown'
    }
  }

  if (rawType !== 'image') {
    return null
  }

  const src = resolveImageSource(obj)
  if (src == null) {
    return null
  }

  return {
    type: 'image',
    src,
    alt: typeof obj.alt === 'string' ? obj.alt : undefined,
    title: typeof obj.title === 'string' ? obj.title : undefined,
    width: typeof obj.width === 'number' ? obj.width : undefined,
    height: typeof obj.height === 'number' ? obj.height : undefined
  }
}

export const getStructuredBlocks = (value: unknown): StructuredBlock[] | null => {
  const parsed = parseStructuredInput(toSerializable(value))
  if (Array.isArray(parsed)) {
    const blocks = parsed.map(parseBlock)
    return blocks.every(Boolean) ? blocks as StructuredBlock[] : null
  }

  if (parsed != null && typeof parsed === 'object') {
    const container = parsed as Record<string, unknown>
    const content = container.content ?? container.items ?? container.blocks
    if (Array.isArray(content)) {
      const blocks = content.map(parseBlock)
      return blocks.every(Boolean) ? blocks as StructuredBlock[] : null
    }
  }

  const single = parseBlock(parsed)
  return single != null ? [single] : null
}

export const getStringList = (value: unknown): string[] | null => {
  const parsed = parseStructuredInput(toSerializable(value))
  if (!Array.isArray(parsed) || !parsed.every(item => ['string', 'number', 'boolean'].includes(typeof item))) {
    return null
  }

  return parsed.map(item => String(item))
}

export const looksLikeMarkdown = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return false
  }

  return (
    trimmed.startsWith('```') ||
    /^(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s)/m.test(trimmed) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed) ||
    /!\[[^\]]*\]\([^)]+\)/.test(trimmed) ||
    /\|.+\|/.test(trimmed)
  )
}
