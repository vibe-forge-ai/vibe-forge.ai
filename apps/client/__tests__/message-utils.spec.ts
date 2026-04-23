import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@vibe-forge/core'

import {
  getLastAssistantActionAnchorId,
  getLastMessageAnchorId
} from '#~/components/chat/messages/message-action-utils'
import { processMessages } from '#~/components/chat/messages/message-utils'

const createMessage = (
  id: string,
  role: ChatMessage['role'],
  content: ChatMessage['content']
): ChatMessage => ({
  id,
  role,
  content,
  createdAt: 1_700_000_000_000
})

describe('message render utils', () => {
  it('does not attach visible assistant actions to text when the latest render item is a tool group', () => {
    const renderItems = processMessages([
      createMessage('user-1', 'user', 'Run the checks.'),
      createMessage('assistant-1', 'assistant', [
        { type: 'text', text: 'I will run the checks now.' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'adapter:codex:Shell',
          input: { cmd: 'pnpm test' }
        }
      ])
    ])

    expect(renderItems.map(item => item.type)).toEqual(['message', 'message', 'tool-group'])
    expect(getLastAssistantActionAnchorId(renderItems)).toBeNull()
  })

  it('keeps actions on the latest assistant text when the turn ends with text', () => {
    const renderItems = processMessages([
      createMessage('user-1', 'user', 'Summarize the output.'),
      createMessage('assistant-1', 'assistant', [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'adapter:codex:Shell',
          input: { cmd: 'pnpm test' }
        },
        { type: 'text', text: 'The checks passed.' }
      ])
    ])
    let latestMessageAnchorId: string | undefined
    for (let index = renderItems.length - 1; index >= 0; index -= 1) {
      const item = renderItems[index]
      if (item?.type === 'message' && item.message.role === 'assistant') {
        latestMessageAnchorId = item.anchorId
        break
      }
    }

    expect(latestMessageAnchorId).toBeDefined()
    expect(getLastAssistantActionAnchorId(renderItems)).toBe(latestMessageAnchorId)
  })

  it('tracks the latest message bubble even when tool groups are rendered after it', () => {
    const renderItems = processMessages([
      createMessage('user-1', 'user', 'Run the checks.'),
      createMessage('assistant-1', 'assistant', [
        { type: 'text', text: 'I will run the checks now.' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'adapter:codex:Shell',
          input: { cmd: 'pnpm test' }
        }
      ])
    ])
    let latestMessageAnchorId: string | undefined
    for (let index = renderItems.length - 1; index >= 0; index -= 1) {
      const item = renderItems[index]
      if (item?.type === 'message') {
        latestMessageAnchorId = item.anchorId
        break
      }
    }

    expect(latestMessageAnchorId).toBeDefined()
    expect(getLastMessageAnchorId(renderItems)).toBe(latestMessageAnchorId)
  })

  it('returns the newest user message bubble when a user message is last', () => {
    const renderItems = processMessages([
      createMessage('user-1', 'user', 'Start.'),
      createMessage('assistant-1', 'assistant', 'Done.'),
      createMessage('user-2', 'user', 'One more thing.')
    ])

    expect(getLastMessageAnchorId(renderItems)).toBe('message-user-2')
  })

  it('preserves the existing latest assistant action when a user message follows it', () => {
    const renderItems = processMessages([
      createMessage('user-1', 'user', 'Start.'),
      createMessage('assistant-1', 'assistant', 'Done.'),
      createMessage('user-2', 'user', 'One more thing.')
    ])

    expect(getLastAssistantActionAnchorId(renderItems)).toBe('message-assistant-1')
  })
})
