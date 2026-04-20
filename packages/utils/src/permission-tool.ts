import {
  CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
  isCanonicalVibeForgeMcpServerName,
  resolveMcpPermissionServerKey,
  sanitizeMcpPermissionKeySegment
} from './vibe-forge-mcp'

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
  CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
  'WebFetch',
  'WebSearch'
] as const

export type CanonicalPermissionToolKey = (typeof CANONICAL_PERMISSION_TOOL_KEYS)[number]

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

const normalizeAliasKey = (value: string) => value.replace(/[\s_-]+/g, '').toLowerCase()

const sanitizeBareKey = (value: string) => value.replace(/[^a-z0-9-]+/gi, '').toLowerCase()

export const isBarePermissionKey = (value: string) => /^[a-z][a-z0-9-]*$/i.test(value)

export const normalizePermissionToolName = (
  value: string | undefined,
  input: {
    mcpServer?: string
  } = {}
): PermissionToolSubject | undefined => {
  const serverName = input.mcpServer?.trim()
  if (serverName != null && serverName !== '') {
    if (isCanonicalVibeForgeMcpServerName(serverName)) {
      return {
        key: CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
        label: CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
        scope: 'tool'
      }
    }

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

  const adapterToolName = trimmed.match(/^adapter:[^:]+:(.+)$/)?.[1]?.trim()
  if (adapterToolName != null && adapterToolName !== '') {
    return normalizePermissionToolName(adapterToolName)
  }

  const mcpSubjectMatch = trimmed.match(/^([^:]+):([^:]+)$/)
  if (mcpSubjectMatch != null) {
    const serverKey = resolveMcpPermissionServerKey(mcpSubjectMatch[1])
    const toolKey = sanitizeMcpPermissionKeySegment(mcpSubjectMatch[2])
    if (serverKey != null && toolKey != null) {
      const key = `mcp-${serverKey}-${toolKey}`
      return {
        key,
        label: trimmed,
        scope: 'tool'
      }
    }
  }

  if (trimmed.startsWith('mcp__')) {
    const parts = trimmed.split('__')
    const serverPart = parts[1]?.trim()
    if (isCanonicalVibeForgeMcpServerName(serverPart)) {
      return {
        key: CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
        label: CANONICAL_VIBE_FORGE_MCP_SERVER_NAME,
        scope: 'tool'
      }
    }

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
      key: bareKey,
      label: bareKey,
      scope: 'tool'
    }
  }

  return undefined
}
