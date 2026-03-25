import { asPlainRecord } from './object-utils'

const parseTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

export interface OpenCodeSessionRecord {
  id: string
  title?: string
  updatedAt?: number
}

export const extractOpenCodeSessionRecords = (input: unknown): OpenCodeSessionRecord[] => {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  const record = asPlainRecord(parsed)
  const payload = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record?.sessions)
      ? record.sessions as unknown[]
      : Array.isArray(record?.items)
        ? record.items as unknown[]
        : []

  return payload.flatMap((entry) => {
    const current = asPlainRecord(entry)
    if (!current) return []

    const id = [current.id, current.sessionId, current.sessionID]
      .find((value): value is string => typeof value === 'string' && value.trim() !== '')
    if (id == null) return []

    return [{
      id,
      title: typeof current.title === 'string' && current.title.trim() !== '' ? current.title : undefined,
      updatedAt: parseTimestamp(
        current.updatedAt ??
        current.updated_at ??
        current.modifiedAt ??
        current.modified_at ??
        current.createdAt ??
        current.created_at
      )
    }]
  })
}

export const selectOpenCodeSessionByTitle = (
  sessions: OpenCodeSessionRecord[],
  title: string
) => (
  sessions
    .filter(session => session.title === title)
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0]
)
