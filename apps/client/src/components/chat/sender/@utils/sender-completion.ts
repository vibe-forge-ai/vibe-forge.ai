import type { SessionInfo } from '@vibe-forge/types'

export type SenderCompletionTrigger = '/' | '@' | '#'

export type SenderCompletionKind = 'command' | 'agent' | 'tool'

export interface SenderCompletionItem {
  kind: SenderCompletionKind
  label: string
  value: string
}

export interface SenderCompletionMatch {
  trigger: SenderCompletionTrigger
  kind: SenderCompletionKind
  query: string
  replaceStart: number
  cursorOffset: number
  items: SenderCompletionItem[]
}

export interface SenderTokenDecoration {
  start: number
  end: number
  className: string
}

interface CompletionSource {
  trigger: SenderCompletionTrigger
  kind: SenderCompletionKind
  values: string[]
}

const COMPLETION_MATCHER = /(^|\s)([@/#])([^\s@/#]*)$/

const TOKEN_MATCHER = /(^|\s)([@/#])([^\s@/#]+)/g

const DEMO_COMPLETION_SOURCES: CompletionSource[] = [
  {
    trigger: '/',
    kind: 'command',
    values: ['plan', 'summarize', 'review', 'fix', 'explain']
  },
  {
    trigger: '@',
    kind: 'agent',
    values: ['solution-analyst', 'dev-planner', 'dev-implementer', 'dev-reviewer']
  },
  {
    trigger: '#',
    kind: 'tool',
    values: ['ChromeDevtools', 'Bash', 'Read', 'Edit', 'Search']
  }
]

const getCompletionSources = (sessionInfo?: SessionInfo | null): CompletionSource[] => {
  if (sessionInfo?.type !== 'init') {
    return DEMO_COMPLETION_SOURCES
  }

  const runtimeSources = [
    { trigger: '/', kind: 'command', values: sessionInfo.slashCommands ?? [] },
    { trigger: '@', kind: 'agent', values: sessionInfo.agents ?? [] },
    { trigger: '#', kind: 'tool', values: sessionInfo.tools ?? [] }
  ] satisfies CompletionSource[]

  const hasRuntimeValues = runtimeSources.some(source => source.values.length > 0)

  return hasRuntimeValues ? runtimeSources : DEMO_COMPLETION_SOURCES
}

const getDecorationClassName = (trigger: SenderCompletionTrigger) => {
  if (trigger === '@') {
    return 'chat-input-monaco__token--agent'
  }

  if (trigger === '#') {
    return 'chat-input-monaco__token--tool'
  }

  return 'chat-input-monaco__token--command'
}

const sortCompletionItems = (items: SenderCompletionItem[], query: string) => {
  const normalizedQuery = query.toLowerCase()

  return items.toSorted((left, right) => {
    const leftStartsWith = left.value.toLowerCase().startsWith(normalizedQuery)
    const rightStartsWith = right.value.toLowerCase().startsWith(normalizedQuery)

    if (leftStartsWith !== rightStartsWith) {
      return leftStartsWith ? -1 : 1
    }

    return left.value.localeCompare(right.value)
  })
}

export const resolveSenderCompletionMatch = (
  value: string,
  cursorOffset: number | null,
  sessionInfo?: SessionInfo | null
): SenderCompletionMatch | null => {
  const resolvedCursorOffset = cursorOffset ?? value.length
  const textBeforeCursor = value.slice(0, resolvedCursorOffset)
  const match = COMPLETION_MATCHER.exec(textBeforeCursor)

  if (match == null) {
    return null
  }

  const trigger = match[2] as SenderCompletionTrigger
  const query = match[3] ?? ''
  const replaceStart = resolvedCursorOffset - query.length
  const normalizedQuery = query.toLowerCase()
  const source = getCompletionSources(sessionInfo).find(item => item.trigger === trigger)

  if (source == null) {
    return null
  }

  const items = source.values
    .filter(item => normalizedQuery === '' || item.toLowerCase().includes(normalizedQuery))
    .map(item => ({
      kind: source.kind,
      label: `${trigger}${item}`,
      value: item
    }))

  return {
    trigger,
    kind: source.kind,
    query,
    replaceStart,
    cursorOffset: resolvedCursorOffset,
    items: sortCompletionItems(items, query)
  }
}

export const resolveSenderTokenDecorations = (value: string): SenderTokenDecoration[] => {
  const decorations: SenderTokenDecoration[] = []

  for (const match of value.matchAll(TOKEN_MATCHER)) {
    const leadingWhitespace = match[1] ?? ''
    const trigger = match[2] as SenderCompletionTrigger | undefined
    const token = match[3] ?? ''
    const matchIndex = match.index

    if (trigger == null || matchIndex == null || token === '') {
      continue
    }

    const start = matchIndex + leadingWhitespace.length
    const end = start + 1 + token.length

    decorations.push({
      start,
      end,
      className: getDecorationClassName(trigger)
    })
  }

  return decorations
}
