import type { LarkToolCallSummary } from '#~/types.js'

const MAX_HEADER_ARGS_LENGTH = 96

const resolveTitle = (summary: LarkToolCallSummary) => (
  summary.title?.trim() || `工具调用（${summary.items.length}）`
)

const resolveStatusIcon = (status: LarkToolCallSummary['items'][number]['status']) => {
  if (status === 'success') return '✅'
  if (status === 'error') return '❌'
  return '⏳'
}

const truncateLine = (value: string, maxLength: number) => (
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`
)

const resolveDisplayToolName = (name: string) => {
  const trimmed = name.trim()
  if (trimmed.startsWith('mcp__')) {
    const parts = trimmed.split('__').filter(Boolean)
    return parts.at(-1) ?? trimmed
  }

  if (trimmed.startsWith('adapter:')) {
    return trimmed.split(':').at(-1)?.trim() || trimmed
  }

  return trimmed
}

const resolveInvocationArgsText = (item: LarkToolCallSummary['items'][number]) => {
  const argsText = item.argsText?.trim()
  if (argsText == null || argsText === '') {
    return ''
  }

  return truncateLine(argsText, MAX_HEADER_ARGS_LENGTH)
}

const buildSummaryHeaderText = (item: LarkToolCallSummary['items'][number]) => {
  const argsText = resolveInvocationArgsText(item)
  return `${resolveStatusIcon(item.status)} ${resolveDisplayToolName(item.name)}(${argsText})`
}

const buildSummaryResultText = (item: LarkToolCallSummary['items'][number]) => {
  const resultText = item.resultText?.trim()
  if (resultText != null && resultText !== '') {
    return `**执行结果**\n${item.status === 'error' ? `失败: ${resultText}` : resultText}`
  }

  if (item.status === 'error') {
    return '**执行结果**\n失败，但未返回错误详情。'
  }

  if (item.status === 'success') {
    return '**执行结果**\n执行完成。'
  }

  return '**执行结果**\n执行中，等待返回结果...'
}

const resolveCardTemplate = (summary: LarkToolCallSummary) => {
  if (summary.items.some(item => item.status === 'error')) return 'red'
  if (summary.items.some(item => item.status === 'pending')) return 'yellow'
  return 'blue'
}

const buildSummaryPanel = (
  item: LarkToolCallSummary['items'][number],
  index: number
) => ({
  tag: 'collapsible_panel',
  element_id: `tool_${index + 1}`,
  expanded: false,
  margin: index === 0 ? '0px' : '6px 0px 0px 0px',
  padding: '8px 12px 8px 12px',
  vertical_spacing: '8px',
  header: {
    title: {
      tag: 'plain_text',
      content: buildSummaryHeaderText(item)
    },
    width: 'fill',
    vertical_align: 'center',
    padding: '6px 8px 6px 8px',
    icon: {
      tag: 'standard_icon',
      token: 'down-small-ccm_outlined',
      size: '16px 16px'
    },
    icon_position: 'right',
    icon_expanded_angle: -180
  },
  border: {
    color: 'grey',
    corner_radius: '8px'
  },
  elements: [{
    tag: 'markdown',
    content: buildSummaryResultText(item)
  }]
})

export const buildToolCallSummaryCard = (summary: LarkToolCallSummary) => ({
  schema: '2.0',
  config: {
    wide_screen_mode: true,
    enable_forward: true
  },
  header: {
    template: resolveCardTemplate(summary),
    title: {
      tag: 'plain_text',
      content: resolveTitle(summary)
    }
  },
  body: {
    elements: summary.items.map((item, index) => buildSummaryPanel(item, index))
  }
})
