import type { ChatMessage } from '@vibe-forge/core'

import { safeJsonStringify } from '#~/utils/json.js'

import type { ChannelToolCallSummary, ChannelToolCallSummaryItem } from './middleware/@types/index.js'

const MAX_SUMMARY_LINE_LENGTH = 320

const truncateLine = (value: string, maxLength = MAX_SUMMARY_LINE_LENGTH) => (
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`
)

const toSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim()

const normalizeToolName = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed.startsWith('adapter:')) {
    return trimmed
  }

  return trimmed.split(':').at(-1)?.trim() || trimmed
}

const stringifySummaryValue = (value: unknown) => {
  if (typeof value === 'string') {
    const normalized = toSingleLine(value)
    return normalized === '' ? undefined : truncateLine(normalized)
  }

  const serialized = safeJsonStringify(value).trim()
  if (serialized === '' || serialized === '""' || serialized === 'null') {
    return undefined
  }

  return truncateLine(toSingleLine(serialized))
}

const resolveSummaryTitle = (summary: ChannelToolCallSummary) => (
  summary.title?.trim() || `工具调用（${summary.items.length}）`
)

const buildLegacyToolCallSummary = (message: ChatMessage): ChannelToolCallSummary | undefined => {
  const toolCall = message.toolCall
  if (toolCall == null) {
    return undefined
  }

  const toolUseId = toolCall.id?.trim() || message.id
  return {
    title: '工具调用',
    items: [{
      toolUseId,
      name: normalizeToolName(toolCall.name),
      status: toolCall.status === 'error'
        ? 'error'
        : toolCall.output != null
        ? 'success'
        : 'pending',
      argsText: stringifySummaryValue(toolCall.args),
      resultText: stringifySummaryValue(toolCall.output)
    }]
  }
}

export const extractToolCallSummary = (message: ChatMessage): ChannelToolCallSummary | undefined => {
  if (!Array.isArray(message.content)) {
    return buildLegacyToolCallSummary(message)
  }

  const items: ChannelToolCallSummaryItem[] = []
  for (const item of message.content) {
    if (item.type === 'tool_use') {
      items.push({
        toolUseId: item.id.trim(),
        name: normalizeToolName(item.name),
        status: 'pending',
        argsText: stringifySummaryValue(item.input)
      })
      continue
    }

    if (item.type === 'tool_result') {
      items.push({
        toolUseId: item.tool_use_id.trim(),
        name: item.tool_use_id.trim(),
        status: item.is_error === true ? 'error' : 'success',
        resultText: stringifySummaryValue(item.content)
      })
    }
  }

  if (items.length === 0) {
    return buildLegacyToolCallSummary(message)
  }

  return {
    title: '工具调用',
    items
  }
}

export const mergeToolCallSummaries = (
  current: ChannelToolCallSummary | undefined,
  next: ChannelToolCallSummary
): ChannelToolCallSummary => {
  const items = current?.items.map(item => ({ ...item })) ?? []
  const indexById = new Map(items.map((item, index) => [item.toolUseId, index]))

  for (const item of next.items) {
    const currentIndex = indexById.get(item.toolUseId)
    if (currentIndex == null) {
      indexById.set(item.toolUseId, items.length)
      items.push({ ...item })
      continue
    }

    const existing = items[currentIndex]!
    items[currentIndex] = {
      toolUseId: existing.toolUseId,
      name: item.name !== item.toolUseId ? item.name : existing.name,
      status: item.status,
      argsText: item.argsText ?? existing.argsText,
      resultText: item.resultText ?? existing.resultText
    }
  }

  return {
    title: current?.title ?? next.title ?? '工具调用',
    items
  }
}

const resolveStatusLabel = (status: ChannelToolCallSummaryItem['status']) => {
  if (status === 'success') return '成功'
  if (status === 'error') return '失败'
  return '执行中'
}

export const buildToolCallSummaryText = (summary: ChannelToolCallSummary) => {
  const lines = [resolveSummaryTitle(summary)]

  for (const item of summary.items) {
    lines.push(`工具: ${item.name}`)
    lines.push(`状态: ${resolveStatusLabel(item.status)}`)
    if (item.argsText != null) {
      lines.push(`参数: ${item.argsText}`)
    }
    if (item.resultText != null) {
      lines.push(`${item.status === 'error' ? '错误' : '结果'}: ${item.resultText}`)
    }
  }

  return lines.join('\n')
}
