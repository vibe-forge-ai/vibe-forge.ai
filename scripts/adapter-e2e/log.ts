export interface ParsedHookLogEntry {
  eventName: string
  headerText?: string
  payload: Record<string, unknown>
  rawPayload: string
  textBlock?: string
}

const countIndent = (line: string) => {
  let index = 0
  while (line[index] === ' ') index += 1
  return index
}

const parseYamlScalar = (rawValue: string): unknown => {
  const value = rawValue.trim()
  if (value === '') return ''
  if (value === 'null' || value === '~') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('\'') && value.endsWith('\''))
  ) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, '\'')
      .replace(/\\\\/g, '\\')
  }

  return value
}

const parseYamlBlockScalar = (
  lines: string[],
  startIndex: number,
  minIndent: number
) => {
  const blockLines: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      blockLines.push('')
      index += 1
      continue
    }

    const indent = countIndent(line)
    if (indent < minIndent) break

    blockLines.push(line.slice(minIndent))
    index += 1
  }

  return {
    value: blockLines.join('\n').trimEnd(),
    nextIndex: index
  }
}

const mergeYamlObject = (target: Record<string, unknown>, value: unknown) => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return target
  }

  for (const [key, entry] of Object.entries(value)) {
    target[key] = entry
  }

  return target
}

const parseYamlNode = (
  lines: string[],
  startIndex: number,
  indent: number
): { value: unknown, nextIndex: number } => {
  let index = startIndex
  while (index < lines.length && (lines[index] ?? '').trim() === '') {
    index += 1
  }

  if (index >= lines.length) {
    return { value: {}, nextIndex: index }
  }

  const firstLine = lines[index] ?? ''
  if (countIndent(firstLine) < indent) {
    return { value: {}, nextIndex: index }
  }

  if (firstLine.slice(indent).startsWith('- ')) {
    const items: unknown[] = []

    while (index < lines.length) {
      const line = lines[index] ?? ''
      if (line.trim() === '') {
        index += 1
        continue
      }

      const lineIndent = countIndent(line)
      if (lineIndent < indent) break

      const content = line.slice(indent)
      if (!content.startsWith('- ')) break

      const rest = content.slice(2).trimStart()
      if (rest === '') {
        const nestedStart = index + 1
        const nestedIndent = countIndent(lines[nestedStart] ?? '')
        const parsed = parseYamlNode(lines, nestedStart, nestedIndent)
        items.push(parsed.value)
        index = parsed.nextIndex
        continue
      }

      const colonIndex = rest.indexOf(':')
      if (colonIndex === -1) {
        items.push(parseYamlScalar(rest))
        index += 1
        continue
      }

      const key = rest.slice(0, colonIndex).trim()
      const rawValue = rest.slice(colonIndex + 1).trimStart()
      const item: Record<string, unknown> = {}

      if (rawValue === '') {
        const nestedStart = index + 1
        const nestedIndent = countIndent(lines[nestedStart] ?? '')
        const parsed = parseYamlNode(lines, nestedStart, nestedIndent)
        item[key] = parsed.value
        index = parsed.nextIndex
      } else if (/^[>|]/.test(rawValue)) {
        const parsed = parseYamlBlockScalar(lines, index + 1, lineIndent + 2)
        item[key] = parsed.value
        index = parsed.nextIndex
      } else {
        item[key] = parseYamlScalar(rawValue)
        index += 1
      }

      if (index < lines.length) {
        const nextIndent = countIndent(lines[index] ?? '')
        if ((lines[index] ?? '').trim() !== '' && nextIndent > lineIndent) {
          const parsed = parseYamlNode(lines, index, nextIndent)
          mergeYamlObject(item, parsed.value)
          index = parsed.nextIndex
        }
      }

      items.push(item)
    }

    return {
      value: items,
      nextIndex: index
    }
  }

  const result: Record<string, unknown> = {}

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      index += 1
      continue
    }

    const lineIndent = countIndent(line)
    if (lineIndent < indent) break
    if (lineIndent > indent) {
      index += 1
      continue
    }

    const content = line.slice(indent)
    const colonIndex = content.indexOf(':')
    if (colonIndex === -1) {
      index += 1
      continue
    }

    const key = content.slice(0, colonIndex).trim()
    const rawValue = content.slice(colonIndex + 1).trimStart()

    if (rawValue === '') {
      const nestedStart = index + 1
      const nestedIndent = countIndent(lines[nestedStart] ?? '')
      if (
        nestedStart >= lines.length ||
        (lines[nestedStart] ?? '').trim() === '' ||
        nestedIndent <= lineIndent
      ) {
        result[key] = null
        index += 1
        continue
      }

      const parsed = parseYamlNode(lines, nestedStart, nestedIndent)
      result[key] = parsed.value
      index = parsed.nextIndex
      continue
    }

    if (/^[>|]/.test(rawValue)) {
      const parsed = parseYamlBlockScalar(lines, index + 1, lineIndent + 2)
      result[key] = parsed.value
      index = parsed.nextIndex
      continue
    }

    result[key] = parseYamlScalar(rawValue)
    index += 1
  }

  return {
    value: result,
    nextIndex: index
  }
}

const parseYamlPayload = (rawPayload: string): Record<string, unknown> => {
  const normalized = rawPayload.trim()
  if (normalized === '' || normalized === 'null' || normalized === 'undefined') {
    return {}
  }

  const parsed = parseYamlNode(rawPayload.split('\n'), 0, 0).value
  return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
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

const parsePayload = (
  rawPayload: string,
  fenceLanguage: string
): Record<string, unknown> => {
  const normalized = rawPayload.trim()
  if (normalized === '' || normalized === 'undefined') {
    return {}
  }

  if (fenceLanguage === 'json') {
    try {
      const parsed = JSON.parse(normalized) as unknown
      return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }

  return parseYamlPayload(normalized)
}

export const parseHookLogEntries = (content: string): ParsedHookLogEntry[] => {
  const entries: ParsedHookLogEntry[] = []
  const lines = content.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index] ?? ''
    const header = parseHeaderLine(headerLine)
    if (header == null) continue
    const payloadFence = (lines[index + 1] ?? '').trim()
    const payloadFenceMatch = /^```(?<language>[a-z]+)$/i.exec(payloadFence)
    if (payloadFenceMatch == null) continue

    const fenceLanguage = payloadFenceMatch.groups?.language?.toLowerCase() ?? ''
    if (fenceLanguage !== 'json' && fenceLanguage !== 'yaml') continue

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
      payload: parsePayload(rawPayload, fenceLanguage),
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
