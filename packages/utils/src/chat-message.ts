import type { ChatMessage, ChatMessageContent } from '@vibe-forge/types'

export const extractTextFromMessage = (message: ChatMessage): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((content: ChatMessageContent) => content.type === 'text')
      .map((content: ChatMessageContent) => ('text' in content ? content.text : ''))
      .join('')
    const fileLines = message.content
      .filter((content): content is Extract<ChatMessageContent, { type: 'file' }> => content.type === 'file')
      .map(content => `Context file: ${content.path}`)

    return [text, ...fileLines].filter(part => part.trim() !== '').join('\n')
  }
  return ''
}
