import type { ChatMessageContent } from '@vibe-forge/core'

import { getClaudeToolSummaryText } from '../adapter-claude/claude-tool-summary'
import { buildClaudeToolPresentation, isClaudeToolName } from '../adapter-claude/claude-tool-presentation'

export type ToolUseItem = Extract<ChatMessageContent, { type: 'tool_use' }>
type Translate = (key: string, options?: Record<string, unknown>) => string

const HUMANIZED_SEGMENT_SEPARATOR = /[_:-]+/g

export const formatToolName = (name: string) => {
  if (name.startsWith('mcp__ChromeDevtools__')) {
    return name.replace('mcp__ChromeDevtools__', '')
  }

  const namespaceSegments = name.split('__').filter(Boolean)
  const lastSegment = namespaceSegments.length > 0
    ? namespaceSegments[namespaceSegments.length - 1]
    : name.split(':').pop() ?? name
  return lastSegment
    .replace(HUMANIZED_SEGMENT_SEPARATOR, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
}

export const getToolInputPreview = (input: unknown) => {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const record = input as Record<string, unknown>
  const preferredKeys = [
    'file_path',
    'path',
    'url',
    'query',
    'pattern',
    'command',
    'selector',
    'taskId',
    'subject',
    'skill',
    'title'
  ]

  for (const key of preferredKeys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim().split('\n')[0]
    }
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim().split('\n')[0]
    }
  }

  return undefined
}

export function getToolSummaryText(item: ToolUseItem, t: Translate) {
  if (isClaudeToolName(item.name)) {
    return getClaudeToolSummaryText(item.name, item.input, t)
  }

  const displayName = formatToolName(item.name)
  const preview = getToolInputPreview(item.input)
  return preview != null && preview !== '' ? `${displayName} ${preview}` : displayName
}

export function getToolTitleText(item: ToolUseItem, t: Translate) {
  if (isClaudeToolName(item.name)) {
    const presentation = buildClaudeToolPresentation(item.name, item.input)
    return t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
  }

  return formatToolName(item.name)
}

export function getToolPrimaryText(item: ToolUseItem) {
  if (isClaudeToolName(item.name)) {
    return buildClaudeToolPresentation(item.name, item.input).primary
  }

  return getToolInputPreview(item.input)
}

export function getToolGroupLabel(item: ToolUseItem, t: Translate) {
  if (isClaudeToolName(item.name)) {
    const presentation = buildClaudeToolPresentation(item.name, item.input)
    return t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
  }

  return formatToolName(item.name)
}

export function getToolGroupSummaryText(
  items: Array<{
    item: ToolUseItem
  }>,
  t: Translate
) {
  const groupedTools = new Map<string, { label: string, count: number }>()

  for (const { item } of items) {
    const label = getToolGroupLabel(item, t)
    if (label === '') continue

    const current = groupedTools.get(label)
    if (current != null) {
      current.count += 1
      continue
    }

    groupedTools.set(label, { label, count: 1 })
  }

  const summaries = Array.from(groupedTools.values()).map(({ label, count }) => (
    t('chat.tools.groupSummaryCount', { name: label, count })
  ))

  if (summaries.length === 0) {
    return t('chat.usedTools', { count: items.length })
  }

  const visible = summaries.slice(0, 2)
  const extraCount = summaries.length - visible.length
  return extraCount > 0 ? `${visible.join(' · ')} +${extraCount}` : visible.join(' · ')
}
