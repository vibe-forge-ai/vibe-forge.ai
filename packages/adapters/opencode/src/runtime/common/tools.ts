import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'

export const DEFAULT_OPENCODE_TOOLS = [
  'bash',
  'edit',
  'glob',
  'grep',
  'patch',
  'write',
  'read',
  'list',
  'lsp',
  'skill',
  'todoread',
  'todowrite',
  'webfetch',
  'websearch',
  'question'
]

export const LEGACY_TOOL_PERMISSION_ALIASES: Record<string, string> = {
  agent: 'task',
  bash: 'bash',
  edit: 'edit',
  fetch: 'webfetch',
  glob: 'glob',
  grep: 'grep',
  list: 'list',
  ls: 'list',
  lsp: 'lsp',
  patch: 'edit',
  read: 'read',
  skill: 'skill',
  task: 'task',
  todoread: 'todoread',
  todowrite: 'todowrite',
  view: 'read',
  webfetch: 'webfetch',
  websearch: 'websearch',
  write: 'edit'
}

const OPEN_CODE_TOOL_ALIASES: Record<string, string> = {
  bash: 'bash',
  edit: 'edit',
  fetch: 'webfetch',
  glob: 'glob',
  grep: 'grep',
  list: 'list',
  ls: 'list',
  lsp: 'lsp',
  patch: 'patch',
  question: 'question',
  read: 'read',
  skill: 'skill',
  todoread: 'todoread',
  todowrite: 'todowrite',
  view: 'read',
  webfetch: 'webfetch',
  websearch: 'websearch',
  write: 'write'
}

const PERMISSION_ONLY_TOOL_KEYS = new Set(['agent', 'task'])
const MANAGED_FLAGS_WITH_VALUE = new Set([
  '--agent', '--attach', '--file', '--format', '--model', '--port', '--session', '--title', '-f', '-m', '-s'
])
const MANAGED_FLAGS = new Set(['--continue', '--fork', '--share', '-c'])

export const buildToolConfig = (tools: AdapterQueryOptions['tools']) => {
  const result: Record<string, boolean> = {}

  for (const [list, enabled] of [[tools?.exclude ?? [], false], [tools?.include ?? [], true]] as const) {
    for (const name of list) {
      const key = name.trim()
      if (key === '' || key === '*' || PERMISSION_ONLY_TOOL_KEYS.has(key)) continue
      result[OPEN_CODE_TOOL_ALIASES[key] ?? key] = enabled
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

export const sanitizeOpenCodeExtraOptions = (extraOptions?: string[]) => {
  const sanitized: string[] = []

  for (let index = 0; index < (extraOptions ?? []).length; index += 1) {
    const current = extraOptions?.[index]
    if (current == null) continue
    if (MANAGED_FLAGS_WITH_VALUE.has(current)) {
      index += 1
      continue
    }
    if (!MANAGED_FLAGS.has(current)) {
      sanitized.push(current)
    }
  }

  return sanitized
}

export const buildOpenCodeRunArgs = (params: {
  prompt?: string
  files: string[]
  model?: string
  agent?: string
  share?: boolean
  title?: string
  opencodeSessionId?: string
  extraOptions?: string[]
}) => {
  const args = ['run', '--format', 'default']

  if (params.opencodeSessionId) {
    args.push('--session', params.opencodeSessionId)
  } else if (params.title) {
    args.push('--title', params.title)
  }

  if (params.model) args.push('--model', params.model)
  if (params.agent) args.push('--agent', params.agent)
  if (params.share) args.push('--share')

  for (const file of params.files) args.push('--file', file)
  args.push(...sanitizeOpenCodeExtraOptions(params.extraOptions))
  if (params.prompt != null && params.prompt !== '') args.push(params.prompt)

  return args
}
