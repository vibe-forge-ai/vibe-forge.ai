import type { LarkToolCallSummary } from '#~/types.js'

import { buildToolCallSummaryHeaderText, buildToolCallSummaryPanelElements } from './tool-call-card-format.js'

const resolveTitle = (summary: LarkToolCallSummary) => (
  summary.title?.trim() || `工具调用（${summary.items.length}）`
)

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
      content: buildToolCallSummaryHeaderText(item)
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
  elements: buildToolCallSummaryPanelElements(item)
})

export const buildToolCallSummaryCard = (summary: LarkToolCallSummary) => ({
  schema: '2.0',
  config: {
    wide_screen_mode: true,
    enable_forward: true,
    update_multi: true
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
