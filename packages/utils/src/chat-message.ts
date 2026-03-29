import type { ChatMessage, ChatMessageContent } from '@vibe-forge/types'

export const extractTextFromMessage = (message: ChatMessage): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((content: ChatMessageContent) => content.type === 'text')
      .map((content: ChatMessageContent) => ('text' in content ? content.text : ''))
      .join('')
  }
  return ''
}
