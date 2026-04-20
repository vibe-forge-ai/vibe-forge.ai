import { describe, expect, it } from 'vitest'

import { buildChatHistoryStatusNotices } from '#~/components/chat/messages/build-chat-history-status-notices'

const dictionary = {
  'chat.modelConfigRequired': 'Add a model service in config before starting a session',
  'chat.modelConfigRequiredTitle': 'Model setup required',
  'chat.modelConfigRequiredHelp': 'Add at least one model service, then retry sending from the composer.',
  'chat.connectionErrorTitle': 'Connection error',
  'chat.connectionClosedTitle': 'Connection closed',
  'chat.connectionErrorHelp': 'Retry to resubscribe to the running session.',
  'chat.connectionClosedHelp': 'Retry to reconnect and continue receiving new messages.',
  'chat.sessionErrorTitle': 'Task failed',
  'chat.sessionErrorHelp': 'Check the latest tool output or terminal logs.',
  'chat.sessionCreateFailedTitle': 'Session creation failed',
  'chat.sessionCreateFailedHelp': 'Retry with the same message.',
  'chat.sessionErrorCode': 'Error code: {{code}}',
  'chat.debugMockConnectionErrorMessage': 'Mock connection error',
  'chat.debugMockConnectionClosedMessage': 'Mock connection closed',
  'chat.debugMockSessionErrorMessage': 'Mock session error'
} satisfies Record<string, string>

const t = (key: string, options?: Record<string, unknown>) => {
  const template = dictionary[key as keyof typeof dictionary]
  if (template == null) {
    return key
  }

  if (options?.code != null) {
    return template.replace('{{code}}', String(options.code))
  }

  return template
}

describe('buildChatHistoryStatusNotices', () => {
  it('returns debug preview notices even when the session has no live errors yet', () => {
    expect(
      buildChatHistoryStatusNotices({
        errorState: null,
        isDebugMode: true,
        modelUnavailable: false,
        t
      }).map(notice => notice.id)
    ).toEqual([
      'mock-connection-error',
      'mock-connection-closed',
      'mock-session-error',
      'mock-model-unavailable'
    ])
  })

  it('maps the active session failure into a single history notice', () => {
    expect(buildChatHistoryStatusNotices({
      errorState: {
        kind: 'session',
        message: 'The adapter crashed while waiting for tool output.',
        code: 'adapter_runtime_failed'
      },
      isDebugMode: false,
      modelUnavailable: false,
      t
    })).toEqual([
      {
        detail: 'Check the latest tool output or terminal logs.',
        icon: 'error',
        id: 'session-error',
        isMock: false,
        message: 'The adapter crashed while waiting for tool output.',
        meta: 'Error code: adapter_runtime_failed',
        tone: 'error',
        title: 'Task failed'
      }
    ])
  })

  it('maps an optimistic session creation failure to a retryable notice', () => {
    expect(buildChatHistoryStatusNotices({
      errorState: {
        action: 'retry-session-creation',
        kind: 'session',
        message: 'Worktree provisioning failed.',
        code: 'session_create_failed'
      },
      isDebugMode: false,
      modelUnavailable: false,
      t
    })).toEqual([
      {
        action: 'retry-session-creation',
        detail: 'Retry with the same message.',
        icon: 'error',
        id: 'session-create-failed',
        isMock: false,
        message: 'Worktree provisioning failed.',
        tone: 'error',
        title: 'Session creation failed'
      }
    ])
  })

  it('adds debug preview scenarios without duplicating the live state', () => {
    const notices = buildChatHistoryStatusNotices({
      errorState: {
        kind: 'connection',
        message: 'Live connection failed.',
        reason: 'error'
      },
      isDebugMode: true,
      modelUnavailable: true,
      t
    })

    expect(notices.map(notice => notice.id)).toEqual([
      'model-unavailable',
      'connection-error',
      'mock-connection-closed',
      'mock-session-error'
    ])
    expect(notices.find(notice => notice.id === 'connection-error')?.action).toBe('retry-connection')
    expect(notices.find(notice => notice.id === 'mock-connection-closed')?.action).toBeUndefined()
  })
})
