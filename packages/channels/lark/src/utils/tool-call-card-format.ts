import type { LarkToolCallSummary } from '#~/types.js'

import {
  buildSummarySectionText,
  resolveCodeBlockContent,
  truncateCodeBlockContent
} from './tool-call-card-content.js'
import { normalizeToolDisplayName } from './tool-call-name.js'

const MAX_HEADER_ARGS_LENGTH = 96
const MAX_HEADER_STRING_LENGTH = 48

const truncateLine = (value: string, maxLength: number) => (
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`
)

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

const sanitizeHeaderValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > MAX_HEADER_STRING_LENGTH ? '...' : value
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeHeaderValue(item))
  }

  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeHeaderValue(item)])
    )
  }

  return value
}

const formatHeaderArgsText = (argsText: string) => {
  const parsed = tryParseJson(argsText)
  if (parsed != null) {
    const sanitized = sanitizeHeaderValue(parsed)
    const serialized = JSON.stringify(sanitized) ?? ''
    if (serialized.length <= MAX_HEADER_ARGS_LENGTH) {
      return serialized
    }
    if (Array.isArray(parsed)) return '[...]'
    if (typeof parsed === 'object') return '{...}'
    return '...'
  }

  const singleLine = argsText.replace(/\s+/g, ' ').trim()
  if (singleLine === '') return ''
  if (singleLine.length > MAX_HEADER_STRING_LENGTH) return '...'
  return truncateLine(singleLine, MAX_HEADER_ARGS_LENGTH)
}

const buildJsonFileButton = (url: string) => ({
  tag: 'button',
  type: 'default',
  size: 'small',
  text: {
    tag: 'plain_text',
    content: '发送完整 JSON 文件'
  },
  url
})

const buildDetailLinkText = (detailUrl: string) => `**详情**\n[在 Server 中查看工具调用详情](${detailUrl})`

export const buildToolCallSummaryHeaderText = (item: LarkToolCallSummary['items'][number]) => {
  const argsText = formatHeaderArgsText(item.argsText?.trim() ?? '')
  const statusIcon = item.status === 'success' ? '✅' : item.status === 'error' ? '❌' : '⏳'
  return `${statusIcon} ${normalizeToolDisplayName(item.name)}(${argsText})`
}

export const buildToolCallSummaryPanelElements = (
  item: LarkToolCallSummary['items'][number]
) => {
  const elements: Array<Record<string, unknown>> = []
  const argsText = item.argsText?.trim()
  if (argsText != null && argsText !== '') {
    elements.push({
      tag: 'markdown',
      content: buildSummarySectionText('传入参数', resolveCodeBlockContent(argsText))
    })
  }

  const resultText = item.resultText?.trim()
  if (resultText != null && resultText !== '') {
    const preview = truncateCodeBlockContent(resultText)
    elements.push({
      tag: 'markdown',
      content: buildSummarySectionText(
        item.status === 'error' ? '执行结果（失败）' : '执行结果',
        preview
      )
    })
    if (preview.truncated && item.exportJsonUrl != null && item.exportJsonUrl.trim() !== '') {
      elements.push(buildJsonFileButton(item.exportJsonUrl.trim()))
    }
  } else {
    const fallback = item.status === 'error'
      ? '**执行结果**\n失败，但未返回错误详情。'
      : item.status === 'success'
      ? '**执行结果**\n执行完成。'
      : '**执行结果**\n执行中，等待返回结果...'
    elements.push({ tag: 'markdown', content: fallback })
  }

  if (item.detailUrl != null && item.detailUrl.trim() !== '') {
    elements.push({
      tag: 'markdown',
      content: buildDetailLinkText(item.detailUrl.trim())
    })
  }

  return elements
}
