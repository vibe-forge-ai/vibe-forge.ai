import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessageContent, SessionQueuedMessage } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { consumeQueuedTurn, moveSessionQueuedMessage, shouldInterruptForQueuedNext } from '#~/services/session/queue.js'
import { broadcastSessionEvent, getSessionQueueRuntimeState } from '#~/services/session/runtime.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/services/session/runtime.js', async () => {
  const actual = await vi.importActual<typeof import('#~/services/session/runtime.js')>(
    '#~/services/session/runtime.js'
  )

  return {
    ...actual,
    broadcastSessionEvent: vi.fn(),
    getSessionQueueRuntimeState: vi.fn()
  }
})

describe('session queue service', () => {
  const listSessionQueuedMessages = vi.fn()
  const moveSessionQueuedMessageInDb = vi.fn()
  const deleteSessionQueuedMessage = vi.fn()
  const getSession = vi.fn()
  const runtime = {
    nextInterruptRequested: false,
    nextInterruptPending: false
  }

  const createQueuedMessage = (
    id: string,
    mode: 'steer' | 'next',
    content: ChatMessageContent[]
  ): SessionQueuedMessage => ({
    id,
    sessionId: 'sess-1',
    mode,
    content,
    createdAt: 1,
    updatedAt: 1,
    order: 0
  })

  let queueItems: SessionQueuedMessage[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    runtime.nextInterruptRequested = false
    runtime.nextInterruptPending = false
    queueItems = []

    listSessionQueuedMessages.mockImplementation(() => queueItems)
    moveSessionQueuedMessageInDb.mockImplementation((_sessionId: string, id: string, mode: 'steer' | 'next') => {
      const target = queueItems.find(item => item.id === id)
      if (target == null) {
        return undefined
      }

      const sourceMode = target.mode
      const nextOrder = queueItems.filter(item => item.mode === mode).length
      queueItems = queueItems
        .map((item) => {
          if (item.id === id) {
            return {
              ...item,
              mode,
              order: nextOrder
            }
          }

          if (item.mode === sourceMode && item.order > target.order) {
            return {
              ...item,
              order: item.order - 1
            }
          }

          return item
        })
      return queueItems.find(item => item.id === id)
    })
    deleteSessionQueuedMessage.mockImplementation((_sessionId: string, id: string) => {
      queueItems = queueItems.filter(item => item.id !== id)
      return true
    })
    getSession.mockReturnValue({
      id: 'sess-1',
      status: 'completed'
    })

    vi.mocked(getDb).mockReturnValue({
      listSessionQueuedMessages,
      moveSessionQueuedMessage: moveSessionQueuedMessageInDb,
      deleteSessionQueuedMessage,
      getSession
    } as any)
    vi.mocked(getSessionQueueRuntimeState).mockReturnValue(runtime)
  })

  it('only interrupts queued next turns at safe points', () => {
    queueItems = [
      createQueuedMessage('next-1', 'next', [{ type: 'text', text: 'queued next' }])
    ]
    runtime.nextInterruptRequested = true

    expect(shouldInterruptForQueuedNext('sess-1', {
      type: 'message',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'still thinking' }],
        createdAt: 1
      }
    })).toBe(false)
    expect(runtime.nextInterruptRequested).toBe(true)
    expect(runtime.nextInterruptPending).toBe(false)

    expect(shouldInterruptForQueuedNext('sess-1', {
      type: 'message',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'done' }],
        createdAt: 1
      }
    })).toBe(true)
    expect(runtime.nextInterruptRequested).toBe(false)
    expect(runtime.nextInterruptPending).toBe(true)
  })

  it('consumes next items before steer items', () => {
    queueItems = [
      createQueuedMessage('steer-1', 'steer', [{ type: 'text', text: 'steer 1' }]),
      createQueuedMessage('next-1', 'next', [{ type: 'text', text: 'next 1' }]),
      createQueuedMessage('next-2', 'next', [{ type: 'text', text: 'next 2' }])
    ]
    runtime.nextInterruptPending = true

    const consumed = consumeQueuedTurn('sess-1')

    expect(consumed.item?.id).toBe('next-1')
    expect(consumed.remaining.next.map(item => item.id)).toEqual(['next-2'])
    expect(consumed.remaining.steer.map(item => item.id)).toEqual(['steer-1'])
    expect(deleteSessionQueuedMessage).toHaveBeenCalledWith('sess-1', 'next-1')
    expect(runtime.nextInterruptPending).toBe(false)
    expect(runtime.nextInterruptRequested).toBe(true)
    expect(vi.mocked(broadcastSessionEvent)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'session_queue_updated'
      })
    )
  })

  it('moves queued items between steer and next queues', () => {
    queueItems = [
      createQueuedMessage('next-1', 'next', [{ type: 'text', text: 'next 1' }]),
      createQueuedMessage('steer-1', 'steer', [{ type: 'text', text: 'steer 1' }])
    ]

    const moved = moveSessionQueuedMessage('sess-1', 'steer-1', 'next')

    expect(moved?.mode).toBe('next')
    expect(queueItems.filter(item => item.mode === 'next').map(item => item.id)).toEqual(['next-1', 'steer-1'])
    expect(runtime.nextInterruptRequested).toBe(false)
    expect(moveSessionQueuedMessageInDb).toHaveBeenCalledWith('sess-1', 'steer-1', 'next')
    expect(vi.mocked(broadcastSessionEvent)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'session_queue_updated'
      })
    )
  })
})
