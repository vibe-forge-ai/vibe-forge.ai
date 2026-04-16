import { describe, expect, it } from 'vitest'

import type { WSEvent } from '@vibe-forge/core'

import { buildSessionToolViews } from '#~/services/session/tool-view.js'

describe('buildSessionToolViews', () => {
  it('uses a composite tool view id so repeated upstream tool ids do not collide', () => {
    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'msg-1',
          role: 'assistant',
          createdAt: 1,
          content: [
            {
              type: 'tool_use',
              id: 'shared-tool-id',
              name: 'bash',
              input: {
                command: 'echo first'
              }
            },
            {
              type: 'tool_result',
              tool_use_id: 'shared-tool-id',
              content: {
                stdout: 'first'
              }
            }
          ]
        }
      },
      {
        type: 'message',
        message: {
          id: 'msg-2',
          role: 'assistant',
          createdAt: 2,
          content: [
            {
              type: 'tool_use',
              id: 'shared-tool-id',
              name: 'bash',
              input: {
                command: 'echo second'
              }
            },
            {
              type: 'tool_result',
              tool_use_id: 'shared-tool-id',
              content: {
                stdout: 'second'
              }
            }
          ]
        }
      }
    ]

    const toolViews = buildSessionToolViews(events)

    expect(Object.keys(toolViews)).toEqual(['msg-1:shared-tool-id', 'msg-2:shared-tool-id'])
    expect(toolViews['msg-1:shared-tool-id']?.summary.primary).toBe('echo first')
    expect(toolViews['msg-2:shared-tool-id']?.summary.primary).toBe('echo second')
  })
})
