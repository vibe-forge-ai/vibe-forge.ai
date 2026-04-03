import { describe, expect, it } from 'vitest'

import { shouldHideSenderForInteraction } from '#~/components/chat/sender/interaction-request'

describe('sender interaction request visibility', () => {
  it('hides the sender for permission interactions', () => {
    expect(shouldHideSenderForInteraction({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否授权？',
        kind: 'permission'
      }
    })).toBe(true)
  })

  it('keeps the sender visible for question interactions', () => {
    expect(shouldHideSenderForInteraction({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '今晚吃了什么？',
        kind: 'question'
      }
    })).toBe(false)
  })

  it('keeps the sender visible when there is no interaction', () => {
    expect(shouldHideSenderForInteraction(null)).toBe(false)
  })
})
