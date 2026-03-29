import { describe, expect, it } from 'vitest'

import { extractTextFromMessage } from '#~/chat-message.js'

describe('chat message helpers', () => {
  it('concatenates text fragments from structured content', () => {
    expect(extractTextFromMessage({
      id: 'msg-1',
      role: 'assistant',
      createdAt: Date.now(),
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'image', url: 'https://example.com/x.png' },
        { type: 'text', text: 'world' }
      ]
    })).toBe('hello world')
  })

  it('returns plain string content directly', () => {
    expect(extractTextFromMessage({
      id: 'msg-2',
      role: 'assistant',
      createdAt: Date.now(),
      content: 'plain text'
    })).toBe('plain text')
  })
})
