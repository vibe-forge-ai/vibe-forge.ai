import { resolve } from 'node:path'

export const CANONICAL_PERMISSION_TOOL_KEYS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'List',
  'Lsp',
  'Task',
  'Skill',
  'Question',
  'TodoRead',
  'TodoWrite',
  'WebFetch',
  'WebSearch'
] as const

export type CanonicalPermissionToolKey = (typeof CANONICAL_PERMISSION_TOOL_KEYS)[number]

export interface SessionPermissionState {
  allow: string[]
  deny: string[]
  onceAllow: string[]
  onceDeny: string[]
}

export interface PermissionToolSubject {
  key: string
  label: string
  scope: 'tool'
}

const CANONICAL_KEY_SET = new Set<string>(CANONICAL_PERMISSION_TOOL_KEYS)

const TOOL_NAME_ALIASES: Record<string, CanonicalPermissionToolKey> = {
  agent: 'Task',
  askuserquestion: 'Question',
  bash: 'Bash',
  command: 'Bash',
  commandexecution: 'Bash',
  commands: 'Bash',
  edit: 'Edit',
  fetch: 'WebFetch',
  glob: 'Glob',
  grep: 'Grep',
  list: 'List',
  ls: 'List',
  lsp: 'Lsp',
  patch: 'Edit',
  question: 'Question',
  read: 'Read',
  readfile: 'Read',
  shell: 'Bash',
  skill: 'Skill',
  subagent: 'Task',
  task: 'Task',
  todoread: 'TodoRead',
  todowrite: 'TodoWrite',
  view: 'Read',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  write: 'Write'
}

const uniqueStrings = (values: string[]) => [...new Set(values)]

const normalizeAliasKey = (value: string) => value.replace(/[\s_-]+/g, '').toLowerCase()

const sanitizeBareKey = (value: string) => value.replace(/[^A-Za-z0-9-]+/g, '')

const toTitleCase = (value: string) => (
  value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`
)

export const createEmptySessionPermissionState = (): SessionPermissionState => ({
  allow: [],
  deny: [],
  onceAllow: [],
  onceDeny: []
})

export const normalizeSessionPermissionState = (value: unknown): SessionPermissionState => {
  const record = value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const normalizeList = (input: unknown) => uniqueStrings(
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
      : []
  )

  return {
    allow: normalizeList(record.allow),
    deny: normalizeList(record.deny),
    onceAllow: normalizeList(record.onceAllow),
    onceDeny: normalizeList(record.onceDeny)
  }
}

export const isBarePermissionKey = (value: string) => /^[A-Za-z][A-Za-z0-9-]*$/.test(value)

export const splitManagedPermissionKeys = (values: string[] | undefined) => {
  const bare: string[] = []
  const other: string[] = []

  for (const raw of values ?? []) {
    const value = raw.trim()
    if (value === '') continue
    if (isBarePermissionKey(value)) {
      bare.push(value)
    } else {
      other.push(value)
    }
  }

  return {
    bare: uniqueStrings(bare),
    other: uniqueStrings(other)
  }
}

export const resolvePermissionMirrorPath = (cwd: string, adapter: string, sessionId: string) => (
  resolve(cwd, '.ai', '.mock', 'permission-state', adapter, `${sessionId}.json`)
)

export const normalizePermissionToolName = (
  value: string | undefined,
  input: {
    mcpServer?: string
  } = {}
): PermissionToolSubject | undefined => {
  const serverName = input.mcpServer?.trim()
  if (serverName != null && serverName !== '') {
    const bareKey = sanitizeBareKey(serverName)
    if (bareKey !== '') {
      return {
        key: bareKey,
        label: bareKey,
        scope: 'tool'
      }
    }
  }

  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') return undefined

  if (CANONICAL_KEY_SET.has(trimmed)) {
    return {
      key: trimmed,
      label: trimmed,
      scope: 'tool'
    }
  }

  if (trimmed.startsWith('mcp__')) {
    const parts = trimmed.split('__')
    const serverPart = parts[1]?.trim()
    const bareKey = sanitizeBareKey(serverPart ?? '')
    if (bareKey !== '') {
      return {
        key: bareKey,
        label: bareKey,
        scope: 'tool'
      }
    }
  }

  const normalizedAlias = normalizeAliasKey(trimmed)
  const mappedAlias = TOOL_NAME_ALIASES[normalizedAlias]
  if (mappedAlias != null) {
    return {
      key: mappedAlias,
      label: mappedAlias,
      scope: 'tool'
    }
  }

  const bareKey = sanitizeBareKey(trimmed)
  if (bareKey !== '' && isBarePermissionKey(bareKey)) {
    return {
      key: toTitleCase(bareKey),
      label: toTitleCase(bareKey),
      scope: 'tool'
    }
  }

  return undefined
}
