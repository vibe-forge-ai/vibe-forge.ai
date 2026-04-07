import type { LarkChannelMessage } from '#~/types.js'

const markdownBlockPattern = /(^|\n)\s*(?:#{1,6}\s|>\s|[-+*]\s|\d+\.\s|```)/m
const markdownDividerPattern = /(^|\n)\s*---+\s*($|\n)/m
const markdownInlinePattern = /(^|[\s(])(?:~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*)(?=$|[\s).,!?:;])/m

const shouldSendAsMarkdownPost = (text: string) => {
  const trimmed = text.trim()
  if (trimmed === '') {
    return false
  }

  return markdownBlockPattern.test(trimmed) ||
    markdownDividerPattern.test(trimmed) ||
    markdownInlinePattern.test(trimmed)
}

const buildTextContent = (text: string) => JSON.stringify({ text })

const buildMarkdownPostContent = (text: string) => JSON.stringify({
  zh_cn: {
    content: [[{
      tag: 'md',
      text
    }]]
  }
})

export const resolveLarkOutboundMessagePayload = (message: LarkChannelMessage) => {
  if (message.toolCallSummary != null && message.toolCallSummary.items.length > 0) {
    return {
      msgType: 'interactive',
      content: null as string | null
    }
  }

  if (shouldSendAsMarkdownPost(message.text)) {
    return {
      msgType: 'post',
      content: buildMarkdownPostContent(message.text)
    }
  }

  return {
    msgType: 'text',
    content: buildTextContent(message.text)
  }
}
