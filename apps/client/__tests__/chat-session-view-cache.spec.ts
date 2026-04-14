import { describe, expect, it } from 'vitest'

import {
  createChatSessionViewSnapshot,
  MAX_CHAT_SESSION_VIEW_SNAPSHOTS,
  mergeChatSessionViewSnapshot,
  restoreChatSessionViewSnapshot,
  setChatSessionViewSnapshot
} from '#~/hooks/chat/session-view-cache'

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

  it('does not promote an unhydrated snapshot when patching metadata only', () => {
    const merged = mergeChatSessionViewSnapshot(createChatSessionViewSnapshot(), {
      errorState: {
        kind: 'connection',
        message: 'socket closed',
        reason: 'closed'
      }
    })

    expect(merged.errorState?.message).toBe('socket closed')
    expect(merged.isHydrated).toBe(false)
  })

  it('evicts the oldest cached sessions after reaching the cache limit', () => {
    const cache = new Map()

    for (let index = 0; index <= MAX_CHAT_SESSION_VIEW_SNAPSHOTS; index += 1) {
      setChatSessionViewSnapshot(cache, `session-${index}`, {
        messages: [
          {
            id: `msg-${index}`,
            role: 'user',
            content: `hello ${index}`,
            createdAt: index
          }
        ],
        isHydrated: true
      })
    }

    expect(cache.size).toBe(MAX_CHAT_SESSION_VIEW_SNAPSHOTS)
    expect(cache.has('session-0')).toBe(false)
    expect(cache.has(`session-${MAX_CHAT_SESSION_VIEW_SNAPSHOTS}`)).toBe(true)
  })
})
