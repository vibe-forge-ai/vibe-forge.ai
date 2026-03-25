export const asPlainRecord = (value: unknown): Record<string, unknown> | undefined => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
)

export const normalizeStringRecord = (value: unknown) => {
  const result: Record<string, string> = {}
  const record = asPlainRecord(value)
  if (!record) return result

  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string' && entry !== '') {
      result[key] = entry
    }
  }

  return result
}

export const deepMerge = (base: Record<string, unknown>, override: Record<string, unknown>) => {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const baseRecord = asPlainRecord(result[key])
    const valueRecord = asPlainRecord(value)
    if (baseRecord && valueRecord) {
      result[key] = deepMerge(baseRecord, valueRecord)
      continue
    }
    result[key] = value
  }

  return result
}
