const DEFAULT_TERMINAL_ID = 'default'
const TERMINAL_ID_MAX_LENGTH = 80

export const normalizeTerminalId = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') {
    return DEFAULT_TERMINAL_ID
  }

  const normalized = trimmed.replace(/[^\w.:-]/g, '-').slice(0, TERMINAL_ID_MAX_LENGTH)
  return normalized === '' ? DEFAULT_TERMINAL_ID : normalized
}

export const resolveTerminalRuntimeKey = (sessionId: string, terminalId?: string | null) => {
  const normalizedTerminalId = normalizeTerminalId(terminalId)
  return normalizedTerminalId === DEFAULT_TERMINAL_ID
    ? sessionId
    : `${sessionId}:${normalizedTerminalId}`
}
