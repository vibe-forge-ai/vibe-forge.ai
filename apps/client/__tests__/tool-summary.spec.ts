import { describe, expect, it } from 'vitest'

import { getToolGroupSummaryText } from '#~/components/chat/tools/core/tool-summary'

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'chat.tools.edit') return 'Edit'
  if (key === 'chat.tools.webSearch') return 'Web Search'
  if (key === 'chat.tools.groupSummaryCount') return `${options?.name as string} ${options?.count as number}x`
  if (key === 'chat.tools.groupSummaryMoreCount') return `+${options?.count as number}x`
  if (key === 'chat.usedTools') return `Used ${options?.count as number} tools`
  return (options?.defaultValue as string | undefined) ?? key
}

describe('tool summary', () => {
  it('aggregates group titles by tool type and count', () => {
    const summary = getToolGroupSummaryText([
      {
        item: {
          type: 'tool_use',
          id: 'edit-1',
          name: 'adapter:claude-code:Edit',
          input: { file_path: '/tmp/a.ts' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'edit-2',
          name: 'adapter:claude-code:Edit',
          input: { file_path: '/tmp/b.ts' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'search-1',
          name: 'adapter:claude-code:WebSearch',
          input: { query: 'compact tool header' }
        }
      }
    ], t)

    expect(summary).toBe('Edit File 2x · Web Search 1x')
  })

  it('keeps group summaries compact when there are many tool categories', () => {
    const summary = getToolGroupSummaryText([
      {
        item: {
          type: 'tool_use',
          id: 'search-1',
          name: 'plugin__docs__search_reference',
          input: { query: 'tool rows' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'click-1',
          name: 'mcp__ChromeDevtools__click',
          input: { selector: '#save' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'hover-1',
          name: 'mcp__ChromeDevtools__hover',
          input: { selector: '#save' }
        }
      }
    ], t)

    expect(summary).toBe('search reference 1x · click 1x · +1x')
  })

  it('disambiguates different namespaced tools that share the same display label', () => {
    const summary = getToolGroupSummaryText([
      {
        item: {
          type: 'tool_use',
          id: 'github-search-1',
          name: 'mcp__github__search',
          input: { query: 'tool layout' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'slack-search-1',
          name: 'mcp__slack__search',
          input: { query: 'tool layout' }
        }
      }
    ], t)

    expect(summary).toBe('github search 1x · slack search 1x')
  })

  it('counts hidden tool calls instead of hidden tool categories', () => {
    const summary = getToolGroupSummaryText([
      {
        item: {
          type: 'tool_use',
          id: 'search-1',
          name: 'plugin__docs__search_reference',
          input: { query: 'tool rows' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'click-1',
          name: 'mcp__ChromeDevtools__click',
          input: { selector: '#save' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'hover-1',
          name: 'mcp__ChromeDevtools__hover',
          input: { selector: '#save' }
        }
      },
      {
        item: {
          type: 'tool_use',
          id: 'hover-2',
          name: 'mcp__ChromeDevtools__hover',
          input: { selector: '#cancel' }
        }
      }
    ], t)

    expect(summary).toBe('search reference 1x · click 1x · +2x')
  })
})
