import { describe, expect, it } from 'vitest'

import {
  applyInteractionStateEvent,
  findLatestFatalError,
  getFatalSessionError,
  restoreInteractionStateFromHistory
} from '#~/hooks/chat/interaction-state'

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

  it('drops stale interactions when a fatal error appears later in history', () => {
    expect(restoreInteractionStateFromHistory([
      {
        type: 'interaction_request',
        id: 'interaction-1',
        payload: {
          sessionId: 'sess-1',
          question: '是否继续？'
        }
      },
      {
        type: 'error',
        data: {
          message: '权限确认已超时，任务未继续执行。',
          fatal: true
        }
      }
    ], {
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }, 'failed')).toBeNull()
  })

  it('falls back to the server-provided interaction when the session is still waiting for input', () => {
    expect(restoreInteractionStateFromHistory([], {
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    }, 'waiting_input')).toEqual({
      id: 'interaction-1',
      payload: {
        sessionId: 'sess-1',
        question: '是否继续？'
      }
    })
  })

  it('reads the latest fatal error payload from stored history', () => {
    expect(findLatestFatalError([
      {
        type: 'error',
        data: {
          message: '旧错误',
          code: 'old_error',
          fatal: true
        }
      },
      {
        type: 'error',
        data: {
          message: '权限确认已超时，任务未继续执行。',
          code: 'permission_request_failed',
          fatal: true
        }
      }
    ])).toEqual({
      message: '权限确认已超时，任务未继续执行。',
      code: 'permission_request_failed'
    })
  })

  it('ignores non-fatal error events when resolving the current session error banner', () => {
    expect(getFatalSessionError({
      type: 'error',
      data: {
        message: '工具执行失败，但会继续重试',
        fatal: false
      }
    })).toBeNull()
  })
})
