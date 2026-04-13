import type { ChatMessageContent } from '@vibe-forge/core'

import {
  buildClaudeToolPresentation,
  getClaudeToolBaseName,
  isClaudeToolName
} from '../adapter-claude/claude-tool-presentation'
import { getClaudeToolSummaryText } from '../adapter-claude/claude-tool-summary'
import { buildGenericToolPresentation } from './generic-tool-presentation'

export type ToolUseItem = Extract<ChatMessageContent, { type: 'tool_use' }>
type Translate = (key: string, options?: Record<string, unknown>) => string

const HUMANIZED_SEGMENT_SEPARATOR = /[_:-]+/g
const GENERIC_TOOL_NAMESPACE_PREFIXES = new Set(['adapter', 'agent', 'mcp', 'plugin', 'tool'])

const humanizeToolSegment = (value: string) =>
  value
    .replace(HUMANIZED_SEGMENT_SEPARATOR, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()

const getToolNameSegments = (name: string) => (
  name.includes('__') ? name.split('__').filter(Boolean) : name.split(':').filter(Boolean)
)

export const formatToolName = (name: string) => {
  if (name.startsWith('mcp__ChromeDevtools__')) {
    return name.replace('mcp__ChromeDevtools__', '')
  }

  const namespaceSegments = name.includes('__') ? name.split('__').filter(Boolean) : []
  const lastSegment = namespaceSegments.length > 0
    ? namespaceSegments[namespaceSegments.length - 1]
    : name.split(':').pop() ?? name
  return humanizeToolSegment(lastSegment)
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

  const presentation = buildGenericToolPresentation(item.name, item.input)
  const displayName = presentation.titleKey != null
    ? t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
    : presentation.fallbackTitle
  const preview = presentation.primary ?? getToolInputPreview(item.input)
  return preview != null && preview !== '' ? `${displayName} ${preview}` : displayName
}

export function getToolTitleText(item: ToolUseItem, t: Translate) {
  if (isClaudeToolName(item.name)) {
    const presentation = buildClaudeToolPresentation(item.name, item.input)
    return t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
  }

  const presentation = buildGenericToolPresentation(item.name, item.input)
  return presentation.titleKey != null
    ? t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
    : presentation.fallbackTitle
}

export function getToolPrimaryText(item: ToolUseItem) {
  if (isClaudeToolName(item.name)) {
    return buildClaudeToolPresentation(item.name, item.input).primary
  }

  return buildGenericToolPresentation(item.name, item.input).primary ?? getToolInputPreview(item.input)
}

const getToolNamespaceLabel = (name: string) => {
  const namespaceSegments = getToolNameSegments(name)
    .slice(0, -1)
    .filter((segment, index) => !(index === 0 && GENERIC_TOOL_NAMESPACE_PREFIXES.has(segment.toLowerCase())))
    .map(humanizeToolSegment)
    .filter(Boolean)

  return namespaceSegments.length > 0 ? namespaceSegments.join(' ') : undefined
}

const getToolQualifiedLabel = (name: string, fallbackLabel: string) => {
  const namespaceLabel = getToolNamespaceLabel(name)
  return namespaceLabel != null && namespaceLabel !== ''
    ? `${namespaceLabel} ${fallbackLabel}`
    : fallbackLabel
}

interface ToolGroupDescriptor {
  key: string
  label: string
  qualifiedLabel: string
}

function getToolGroupDescriptor(item: ToolUseItem, t: Translate): ToolGroupDescriptor {
  if (isClaudeToolName(item.name)) {
    const baseName = getClaudeToolBaseName(item.name)
    const presentation = buildClaudeToolPresentation(item.name, item.input)
    const label = t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
    return {
      key: `claude:${baseName}`,
      label,
      qualifiedLabel: label
    }
  }

  const presentation = buildGenericToolPresentation(item.name, item.input)
  const label = presentation.titleKey != null
    ? t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
    : presentation.fallbackTitle
  return {
    key: item.name,
    label,
    qualifiedLabel: getToolQualifiedLabel(item.name, label)
  }
}

export function getToolGroupSummaryText(
  items: Array<{
    item: ToolUseItem
  }>,
  t: Translate
) {
  const groupedTools = new Map<string, { label: string; qualifiedLabel: string; count: number }>()

  for (const { item } of items) {
    const descriptor = getToolGroupDescriptor(item, t)
    const label = descriptor.label
    if (label === '') continue

    const current = groupedTools.get(descriptor.key)
    if (current != null) {
      current.count += 1
      continue
    }

    groupedTools.set(descriptor.key, {
      label,
      qualifiedLabel: descriptor.qualifiedLabel,
      count: 1
    })
  }

  const groups = Array.from(groupedTools.values())
  const labelCounts = groups.reduce((map, group) => {
    map.set(group.label, (map.get(group.label) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  if (groups.length === 0) {
    return t('chat.usedTools', { count: items.length })
  }

  const summaries = groups.map((group) => {
    const name = (labelCounts.get(group.label) ?? 0) > 1 ? group.qualifiedLabel : group.label
    return {
      count: group.count,
      text: t('chat.tools.groupSummaryCount', { name, count: group.count })
    }
  })

  const visible = summaries.slice(0, 2).map(summary => summary.text)
  const hiddenCallCount = summaries.slice(2).reduce((count, summary) => count + summary.count, 0)

  return hiddenCallCount > 0
    ? [...visible, t('chat.tools.groupSummaryMoreCount', { count: hiddenCallCount })].join(' · ')
    : visible.join(' · ')
}
