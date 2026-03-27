import type { Client } from '@larksuiteoapi/node-sdk'

import type { InboundContentItem, LarkMention, ParsedLarkContent, TenantTokenProvider } from '#~/types.js'
import { isRecord, isRichNode } from './guards'
import { downloadLarkImageAsDataUrl } from './media'
import { escapeXmlAttr, escapeXmlText, formatLarkText, resolveLarkId } from './text-format'

export const parseLarkContent = async (options: {
  content?: string
  mentions?: LarkMention[]
  client?: Client
  tenantTokenProvider?: TenantTokenProvider
}): Promise<ParsedLarkContent> => {
  const { content, mentions, client, tenantTokenProvider } = options
  if (content == null || content === '') return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return {}
  }

  if (isRecord(parsed) && typeof parsed.text === 'string') {
    const rawText = parsed.text
    const formattedText = formatLarkText(rawText, mentions)
    return {
      rawText,
      formattedText,
      contentItems: formattedText != null && formattedText !== '' ? [{ type: 'text', text: formattedText }] : [],
      rich: parsed
    }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.content)) {
    return isRecord(parsed) ? { rich: parsed } : {}
  }

  const mentionIdByKey = new Map<string, { id?: string; name?: string }>()
  for (const m of mentions ?? []) {
    if (m.key == null || m.key === '') continue
    mentionIdByKey.set(m.key, { id: resolveLarkId(m.id), name: m.name })
  }

  const contentItems: InboundContentItem[] = []
  const images: NonNullable<ParsedLarkContent['images']> = []
  let rawText = ''
  let formattedText = ''
  let textBuffer = ''

  const flushText = () => {
    if (textBuffer === '') return
    contentItems.push({ type: 'text', text: textBuffer })
    textBuffer = ''
  }

  const appendText = (value: string) => {
    rawText += value
    formattedText += value
    textBuffer += value
  }

  const appendAt = (userIdRaw: string, userNameRaw: string) => {
    const mapped = mentionIdByKey.get(userIdRaw)
    const resolvedId = mapped?.id ?? userIdRaw
    const resolvedName = mapped?.name ?? userNameRaw
    const rawAt = `<at user_id="${escapeXmlAttr(userIdRaw)}">${escapeXmlText(userNameRaw)}</at>`
    const fmtAt = `<at type="lark" user_id="${escapeXmlAttr(resolvedId ?? '')}">${
      escapeXmlText(resolvedName ?? '')
    }</at>`
    rawText += rawAt
    formattedText += fmtAt
    textBuffer += fmtAt
  }

  const appendImage = async (imageKey: string, width?: number, height?: number) => {
    flushText()
    const imageInfo: NonNullable<ParsedLarkContent['images']>[number] = { imageKey, width, height }
    const tenantToken = tenantTokenProvider ? await tenantTokenProvider() : undefined
    const canDownload = client != null && tenantToken != null && tenantToken !== ''
    if (canDownload) {
      try {
        const downloaded = await downloadLarkImageAsDataUrl(client, imageKey, tenantToken)
        imageInfo.dataUrl = downloaded.dataUrl
        imageInfo.mimeType = downloaded.mimeType
        imageInfo.size = downloaded.size
      } catch (err) {
        void err
      }
    }
    images.push(imageInfo)
    if (imageInfo.dataUrl) {
      contentItems.push({
        type: 'image',
        url: imageInfo.dataUrl,
        name: imageKey,
        size: imageInfo.size,
        mimeType: imageInfo.mimeType
      })
    } else {
      contentItems.push({
        type: 'text',
        text: `<img image_key="${escapeXmlAttr(imageKey)}" />`
      })
    }
    rawText += `<img image_key="${escapeXmlAttr(imageKey)}" />`
    formattedText += `<img image_key="${escapeXmlAttr(imageKey)}" />`
  }

  const richContent = parsed.content
  for (let p = 0; p < richContent.length; p++) {
    const paragraph = richContent[p]
    if (!Array.isArray(paragraph)) continue
    for (let l = 0; l < paragraph.length; l++) {
      const line = paragraph[l]
      if (!Array.isArray(line)) continue
      for (const node of line) {
        if (!isRichNode(node)) continue
        if (node.tag === 'text' && typeof node.text === 'string') {
          appendText(node.text)
        } else if (node.tag === 'at' && typeof node.user_id === 'string') {
          appendAt(node.user_id, typeof node.user_name === 'string' ? node.user_name : '')
        } else if (node.tag === 'img' && typeof node.image_key === 'string') {
          await appendImage(node.image_key, node.width, node.height)
        }
      }
      if (l < paragraph.length - 1) {
        appendText('\n')
      }
    }
    if (p < richContent.length - 1) {
      appendText('\n')
    }
  }

  rawText = rawText.trim()
  formattedText = formattedText.trim()
  if (formattedText !== '' && textBuffer.endsWith('\n')) {
    textBuffer = textBuffer.replace(/\n+$/g, '')
  }
  flushText()

  if (formattedText === '' && images.length > 0) {
    formattedText = '[image]'
  }

  return {
    rawText,
    formattedText,
    contentItems,
    images,
    rich: parsed
  }
}
