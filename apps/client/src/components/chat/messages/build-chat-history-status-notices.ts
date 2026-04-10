import type { ChatErrorState } from '#~/hooks/chat/interaction-state'

type Translate = (key: string, options?: Record<string, unknown>) => string

export interface ChatHistoryStatusNotice {
  action?: 'retry-connection'
  detail?: string
  icon: string
  id: string
  isMock?: boolean
  message: string
  meta?: string
  tone: 'error' | 'warning'
  title: string
}

const createModelUnavailableNotice = (t: Translate, isMock = false): ChatHistoryStatusNotice => ({
  icon: 'settings_suggest',
  id: isMock ? 'mock-model-unavailable' : 'model-unavailable',
  isMock,
  message: t('chat.modelConfigRequired'),
  detail: t('chat.modelConfigRequiredHelp'),
  tone: 'warning',
  title: t('chat.modelConfigRequiredTitle')
})

const createConnectionNotice = (
  t: Translate,
  state: ChatErrorState,
  isMock = false
): ChatHistoryStatusNotice => {
  const isClosed = state.reason === 'closed'

  return {
    action: isMock ? undefined : 'retry-connection',
    detail: isClosed ? t('chat.connectionClosedHelp') : t('chat.connectionErrorHelp'),
    icon: isClosed ? 'wifi_off' : 'cloud_off',
    id: isMock
      ? isClosed ? 'mock-connection-closed' : 'mock-connection-error'
      : isClosed
      ? 'connection-closed'
      : 'connection-error',
    isMock,
    message: state.message,
    tone: 'error',
    title: isClosed ? t('chat.connectionClosedTitle') : t('chat.connectionErrorTitle')
  }
}

const createSessionNotice = (
  t: Translate,
  state: ChatErrorState,
  isMock = false
): ChatHistoryStatusNotice => ({
  detail: t('chat.sessionErrorHelp'),
  icon: 'error',
  id: isMock ? 'mock-session-error' : 'session-error',
  isMock,
  message: state.message,
  meta: state.code != null && state.code !== ''
    ? t('chat.sessionErrorCode', { code: state.code })
    : undefined,
  tone: 'error',
  title: t('chat.sessionErrorTitle')
})

export const buildChatHistoryStatusNotices = ({
  errorState,
  isDebugMode,
  modelUnavailable,
  t
}: {
  errorState?: ChatErrorState | null
  isDebugMode: boolean
  modelUnavailable: boolean
  t: Translate
}) => {
  const notices: ChatHistoryStatusNotice[] = []
  const activeScenarios = new Set<string>()

  if (modelUnavailable) {
    notices.push(createModelUnavailableNotice(t))
    activeScenarios.add('model-unavailable')
  }

  if (errorState != null && errorState.message.trim() !== '') {
    if (errorState.kind === 'session') {
      notices.push(createSessionNotice(t, errorState))
      activeScenarios.add('session-error')
    } else {
      notices.push(createConnectionNotice(t, errorState))
      activeScenarios.add(errorState.reason === 'closed' ? 'connection-closed' : 'connection-error')
    }
  }

  if (!isDebugMode) {
    return notices
  }

  const mockNotices: Array<{ notice: ChatHistoryStatusNotice; scenario: string }> = [
    {
      scenario: 'connection-error',
      notice: createConnectionNotice(t, {
        kind: 'connection',
        message: t('chat.debugMockConnectionErrorMessage'),
        reason: 'error'
      }, true)
    },
    {
      scenario: 'connection-closed',
      notice: createConnectionNotice(t, {
        kind: 'connection',
        message: t('chat.debugMockConnectionClosedMessage'),
        reason: 'closed'
      }, true)
    },
    {
      scenario: 'session-error',
      notice: createSessionNotice(t, {
        kind: 'session',
        message: t('chat.debugMockSessionErrorMessage'),
        code: 'session_timeout'
      }, true)
    },
    {
      scenario: 'model-unavailable',
      notice: createModelUnavailableNotice(t, true)
    }
  ]

  for (const mock of mockNotices) {
    if (!activeScenarios.has(mock.scenario)) {
      notices.push(mock.notice)
    }
  }

  return notices
}
