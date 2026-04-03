const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const sanitizeArray = (value: unknown[]) => value.map((item) => sanitizeOpenAIResponsesInputValue(item))

export const sanitizeOpenAIResponsesInputValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return sanitizeArray(value)
  }

  if (!isPlainObject(value)) {
    return value
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'thinking') {
      continue
    }

    sanitized[key] = sanitizeOpenAIResponsesInputValue(entry)
  }

  return sanitized
}
