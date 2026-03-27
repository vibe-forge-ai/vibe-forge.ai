export interface ParsedHookLogEntry {
  eventName: string
  headerText?: string
  payload: Record<string, unknown>
  rawPayload: string
  textBlock?: string
}

const parseHeaderLine = (line: string) => {
  if (!line.startsWith('# ') || !line.includes('[plugin.logger]')) {
    return undefined
  }

  const eventStart = line.indexOf('[', line.indexOf('__'))
  if (eventStart === -1) return undefined
  const eventEnd = line.indexOf(']', eventStart + 1)
  if (eventEnd === -1) return undefined

  const loggerTag = '[plugin.logger]'
  const loggerIndex = line.indexOf(loggerTag, eventEnd + 1)
  if (loggerIndex === -1) return undefined

  return {
    eventName: line.slice(eventStart + 1, eventEnd).trim(),
    headerText: line.slice(loggerIndex + loggerTag.length).trim() || undefined
  }
}

const parsePayload = (rawPayload: string): Record<string, unknown> => {
  const normalized = rawPayload.trim()
  if (normalized === '' || normalized === 'undefined') {
    return {}
  }

  try {
    const parsed = JSON.parse(normalized) as unknown
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export const parseHookLogEntries = (content: string): ParsedHookLogEntry[] => {
  const entries: ParsedHookLogEntry[] = []
  const lines = content.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index] ?? ''
    const header = parseHeaderLine(headerLine)
    if (header == null) continue
    if ((lines[index + 1] ?? '').trim() !== '```json') continue

    index += 2
    const jsonLines: string[] = []
    while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
      jsonLines.push(lines[index] ?? '')
      index += 1
    }

    const textBlock = (() => {
      if ((lines[index + 1] ?? '').trim() !== '```text') return undefined

      const textLines: string[] = []
      index += 2
      while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
        textLines.push(lines[index] ?? '')
        index += 1
      }
      return textLines.join('\n').trim() || undefined
    })()

    const rawPayload = jsonLines.join('\n')
    entries.push({
      eventName: header.eventName,
      headerText: header.headerText,
      payload: parsePayload(rawPayload),
      rawPayload,
      textBlock
    })
  }

  return entries
}

export const countHookLogEvents = (entries: ParsedHookLogEntry[]) => {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    counts.set(entry.eventName, (counts.get(entry.eventName) ?? 0) + 1)
  }

  return counts
}
