import type { ChatMessage, ChatMessageContent } from '@vibe-forge/core'

export type EditableMessageItem =
  | Extract<ChatMessageContent, { type: 'text' }>
  | Extract<ChatMessageContent, { type: 'image' }>

export type EditableMessageContent = string | EditableMessageItem[]

const isEditableMessageItem = (item: ChatMessageContent): item is EditableMessageItem => {
  return item.type === 'text' || item.type === 'image'
}

const cloneEditableMessageContent = (content: EditableMessageContent) => {
  if (typeof content === 'string') {
    return content
  }

  return content.map((item) => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text } satisfies ChatMessageContent
    }

    return {
      type: 'image',
      url: item.url,
      name: item.name,
      size: item.size,
      mimeType: item.mimeType
    } satisfies ChatMessageContent
  })
}

export const normalizeEditableMessageContent = (content: string | ChatMessageContent[] | undefined) => {
  if (content == null) {
    return undefined
  }

  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed === '' ? undefined : trimmed
  }

  const normalized: EditableMessageItem[] = []
  for (const item of content) {
    if (!isEditableMessageItem(item)) {
      return undefined
    }

    if (item.type === 'text') {
      const text = item.text.trim()
      if (text !== '') {
        normalized.push({ type: 'text', text })
      }
      continue
    }

    normalized.push({
      type: 'image',
      url: item.url,
      name: item.name,
      size: item.size,
      mimeType: item.mimeType
    })
  }

  return normalized.length === 0 ? undefined : normalized
}

export const getEditableMessageContent = (message: ChatMessage) => {
  if (typeof message.content === 'string') {
    const trimmed = message.content.trim()
    return trimmed === '' ? undefined : message.content
  }

  if (!Array.isArray(message.content) || message.toolCall != null) {
    return undefined
  }

  const editableItems = message.content.filter(isEditableMessageItem)
  if (editableItems.length !== message.content.length || editableItems.length === 0) {
    return undefined
  }

  const hasVisibleContent = editableItems.some((item) => item.type === 'image' || item.text.trim() !== '')
  if (!hasVisibleContent) {
    return undefined
  }

  return cloneEditableMessageContent(editableItems)
}

export const isSameEditableMessageContent = (
  left: EditableMessageContent | undefined,
  right: EditableMessageContent | undefined
) => {
  const normalizedLeft = normalizeEditableMessageContent(left)
  const normalizedRight = normalizeEditableMessageContent(right)

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
}

export const getCopyableMessageText = (message: ChatMessage) => {
  if (typeof message.content === 'string') {
    return message.content.trim() === '' ? undefined : message.content
  }

  if (!Array.isArray(message.content)) {
    return undefined
  }

  const textItems = message.content
    .filter((item): item is Extract<ChatMessageContent, { type: 'text' }> => item.type === 'text')
    .map(item => item.text)
    .filter(text => text.trim() !== '')

  if (textItems.length === 0) {
    return undefined
  }

  return textItems.join('\n\n')
}
