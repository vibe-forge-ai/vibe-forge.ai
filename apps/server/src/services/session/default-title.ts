export const DEFAULT_SESSION_TITLE = 'New Session'

export const normalizeSessionTitle = (title?: string) => {
  const trimmed = title?.trim()
  return trimmed != null && trimmed !== '' ? trimmed : DEFAULT_SESSION_TITLE
}
