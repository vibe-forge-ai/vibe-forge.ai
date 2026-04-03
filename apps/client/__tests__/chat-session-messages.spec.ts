import { describe, expect, it } from 'vitest'

import { applyInteractionStateEvent } from '#~/hooks/chat/interaction-state'

describe('chat session interaction state', () => {
  it('stores the latest interaction request payload', () => {
    expect(applyInteractionStateEvent(null, {
      type: 'interaction_request',
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    })).toEqual({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    })
  })

  it('clears the active interaction when a matching response arrives', () => {
    expect(applyInteractionStateEvent({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }, {
      type: 'interaction_response',
      id: 'interaction-1',
      data: '继续'
    })).toBeNull()
  })

  it('clears the interaction when session status leaves waiting_input', () => {
    expect(applyInteractionStateEvent({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }, {
      type: 'session_updated',
      session: {
        id: 'sess-1',
        status: 'running'
      }
    })).toBeNull()
  })

  it('clears the interaction when the session is deleted', () => {
    expect(applyInteractionStateEvent({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }, {
      type: 'session_updated',
      session: {
        id: 'sess-1',
        isDeleted: true
      }
    })).toBeNull()
  })

  it('preserves the active interaction for unrelated responses', () => {
    const current = {
      id: 'interaction-2',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }

    expect(applyInteractionStateEvent(current, {
      type: 'interaction_response',
      id: 'interaction-1',
      data: '继续'
    })).toBe(current)
  })
})
