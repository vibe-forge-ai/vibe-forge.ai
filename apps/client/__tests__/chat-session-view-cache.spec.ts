import { describe, expect, it } from 'vitest'

import { createChatSessionViewSnapshot, mergeChatSessionViewSnapshot, restoreChatSessionViewSnapshot } from '#~/hooks/chat/session-view-cache'

describe('chat session view cache', () => {
  it('restores hydrated snapshots for revisited sessions', () => {
    const restored = restoreChatSessionViewSnapshot(createChatSessionViewSnapshot({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'hello',
          createdAt: 1
        }
      ],
      isHydrated: true
    }))

    expect(restored.messages).toHaveLength(1)
    expect(restored.messages[0]?.content).toBe('hello')
    expect(restored.isReady).toBe(true)
  })

  it('preserves previous values when applying a partial patch', () => {
    const current = createChatSessionViewSnapshot({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'hello',
          createdAt: 1
        }
      ],
      isHydrated: true
    })

    const merged = mergeChatSessionViewSnapshot(current, {
      errorState: {
        kind: 'connection',
        message: 'socket closed',
        reason: 'closed'
      }
    })

    expect(merged.messages).toHaveLength(1)
    expect(merged.errorState?.message).toBe('socket closed')
    expect(merged.isHydrated).toBe(true)
  })
})
