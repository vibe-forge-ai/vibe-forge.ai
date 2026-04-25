import type { ChatMessageContent } from '@vibe-forge/core'

type Translate = (key: string, options?: Record<string, string>) => string

export const buildAutomationCreationText = (
  text: string,
  t: Translate
) => {
  const request = text.trim()
  const lowerRequest = request.toLowerCase()
  if (request.includes('自动化任务工具') || lowerRequest.includes('automation tools')) {
    return request
  }
  return t('automation.emptyLandingSendInstruction', { request })
}

export const buildAutomationCreationContent = (
  content: ChatMessageContent[],
  t: Translate
) => {
  let didWrapText = false
  const nextContent = content.map((item): ChatMessageContent => {
    if (item.type !== 'text' || didWrapText) {
      return item
    }

    didWrapText = true
    return {
      ...item,
      text: buildAutomationCreationText(item.text, t)
    }
  })

  if (didWrapText) return nextContent

  return [
    { type: 'text' as const, text: t('automation.emptyLandingAttachmentInstruction') },
    ...nextContent
  ]
}
