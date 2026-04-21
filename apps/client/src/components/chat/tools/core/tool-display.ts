/* eslint-disable max-lines */

import { safeJsonStringify } from '#~/utils/safe-serialize'

export const TOOL_TOOLTIP_PROPS = {
  arrow: false,
  mouseEnterDelay: .2,
  mouseLeaveDelay: .06
} as const

const PATH_TOOLTIP_MARKERS = ['apps', 'packages', 'src', 'scripts', '.ai', 'docs', 'tests', 'test', 'changelog']
const WINDOWS_PATH_RE = /^[a-z]:[\\/]+/i
const URL_RE = /^https?:\/\//i

const TOOL_FIELD_ICON_MAP: Record<string, string> = {
  activeForm: 'description',
  addBlockedBy: 'link_off',
  addBlocks: 'block',
  allowedDomains: 'travel_explore',
  allowedPrompts: 'chat',
  answers: 'fact_check',
  args: 'segment',
  blockedDomains: 'domain_disabled',
  body: 'notes',
  cellId: 'tag',
  cellType: 'grid_view',
  clientId: 'badge',
  clientIds: 'group',
  command: 'terminal',
  connection: 'lan',
  content: 'notes',
  contextLines: 'format_line_spacing',
  cwd: 'folder_open',
  changes: 'difference',
  description: 'subject',
  disableSandbox: 'shield',
  details: 'info',
  endLine: 'keyboard_double_arrow_down',
  editMode: 'edit',
  glob: 'data_object',
  ignore: 'visibility_off',
  ignoreCase: 'text_fields',
  limit: 'filter_alt',
  maxTurns: 'repeat',
  maxOutputTokens: 'expand_content',
  method: 'http',
  headers: 'list_alt',
  metadata: 'badge',
  model: 'neurology',
  mode: 'tune',
  newSource: 'note_stack',
  newString: 'edit_note',
  oldString: 'history',
  owner: 'person',
  offset: 'format_indent_increase',
  path: 'folder',
  prompt: 'chat',
  pushToRemote: 'upload',
  questions: 'quiz',
  search: 'search',
  remoteSession: 'devices',
  remoteSessionUrl: 'link',
  route: 'route',
  replaceAll: 'select_all',
  resume: 'play_circle',
  runInBackground: 'background_dot_large',
  startLine: 'keyboard_double_arrow_up',
  status: 'flag',
  subagentType: 'hub',
  subject: 'title',
  timeout: 'timer',
  todos: 'checklist',
  workdir: 'folder_code',
  yieldTimeMs: 'schedule'
}

const TOOL_FORMAT_ICON_MAP: Record<string, string> = {
  code: 'code',
  inline: 'label',
  json: 'data_object',
  list: 'format_list_bulleted',
  questions: 'quiz',
  text: 'article'
}

export const getToolSectionIcon = (section: 'call' | 'details' | 'result') => {
  if (section === 'call') return 'tune'
  if (section === 'result') return 'assignment_turned_in'
  return 'info'
}

export const getToolFieldIcon = (labelKey: string, format: string) => {
  const key = labelKey.split('.').pop() ?? labelKey
  return TOOL_FIELD_ICON_MAP[key] ?? TOOL_FORMAT_ICON_MAP[format] ?? 'label'
}

export const getToolValueText = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return safeJsonStringify(value, 2)
}

export const getToolInlineValueText = (value: unknown) => (
  getToolValueText(value).replace(/\s+/g, ' ').trim()
)

export const shouldUseMonospaceTarget = (value: string | undefined) => {
  if (value == null || value === '') {
    return false
  }

  return (
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('#') ||
    value.includes('/')
  )
}

const normalizeToolPath = (value: string) => value.replace(/\\/g, '/')

const looksLikeToolPath = (value: string) => {
  if (URL_RE.test(value)) {
    return false
  }

  const normalized = normalizeToolPath(value)
  if (normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
    return true
  }

  if (WINDOWS_PATH_RE.test(value)) {
    return true
  }

  if (!normalized.includes('/')) {
    return false
  }

  return !normalized.includes(' ')
}

const getPathLabel = (value: string) => {
  const normalized = normalizeToolPath(value)
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? normalized
}

const getPathTooltip = (value: string) => {
  const normalized = normalizeToolPath(value)
  const segments = normalized.split('/').filter(Boolean)
  const markerIndex = segments.findIndex(segment => PATH_TOOLTIP_MARKERS.includes(segment))

  if (markerIndex >= 0) {
    return segments.slice(markerIndex).join('/')
  }

  return normalized
}

export const getToolTargetPresentation = (value: string | undefined) => {
  if (value == null || value.trim() === '') {
    return {
      text: undefined,
      title: undefined,
      monospace: false
    }
  }

  const normalized = value.trim()

  if (looksLikeToolPath(normalized)) {
    return {
      text: getPathLabel(normalized),
      title: getPathTooltip(normalized),
      monospace: true
    }
  }

  if (URL_RE.test(normalized)) {
    try {
      const url = new URL(normalized)
      return {
        text: `${url.hostname}${url.pathname}${url.search}${url.hash}`,
        title: normalized,
        monospace: false
      }
    } catch {
      return {
        text: normalized,
        title: normalized,
        monospace: false
      }
    }
  }

  return {
    text: normalized,
    title: undefined,
    monospace: shouldUseMonospaceTarget(normalized)
  }
}
