import { describe, expect, it } from 'vitest'

import { buildToolCallSummaryCard } from '#~/utils/tool-call-card.js'

const createLongResult = () =>
  JSON.stringify({
    items: Array.from({ length: 80 }, (_, index) => ({
      index,
      value: `line-${index}`
    }))
  })

describe('tool-call-card', () => {
  it('truncates long tool results to 12 lines and adds an export button', () => {
    const summary = {
      items: [{
        toolUseId: 'tool_1',
        name: 'adapter:claude-code:mcp__channel-lark-test__GetCurrentChatMessages',
        status: 'success' as const,
        argsText: '{"limit":4}',
        resultText: createLongResult(),
        detailUrl: 'http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool_1',
        exportJsonUrl: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool_1'
      }]
    }

    const card = buildToolCallSummaryCard(summary)
    expect(card.header.title.content).toBe('工具调用（1）')
    const panel = card.body.elements[0] as {
      header: {
        title: {
          content: string
        }
      }
      expanded: boolean
      elements: Array<Record<string, any>>
    }

    expect(panel.expanded).toBe(false)
    expect(panel.header.title.content).toBe('✅ GetCurrentChatMessages({"limit":4})')
    expect(panel.elements[1]?.content).toContain('**执行结果**')
    expect(panel.elements[1]?.content).toContain('\n...\n```')
    expect(panel.elements[1]?.content).not.toContain('"index": 12')
    expect(panel.elements[2]).toEqual(expect.objectContaining({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: '发送完整 JSON 文件'
      },
      url: 'http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool_1'
    }))
    expect(panel.elements[3]?.content).toContain(
      '[在 Server 中查看工具调用详情](http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool_1)'
    )
  })
})
