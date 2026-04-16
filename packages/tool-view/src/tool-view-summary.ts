import type { ToolViewBadge, ToolViewSummary } from '@vibe-forge/types'

const PATH_KEYS = new Set(['cwd', 'dir', 'directory', 'filePath', 'file_path', 'path', 'workdir'])
const PRIMARY_KEYS = [
  'file_path',
  'path',
  'url',
  'query',
  'pattern',
  'command',
  'selector',
  'taskId',
  'subject',
  'title'
]

const TOOL_ICON_MAP: Record<string, { title: string; icon: string }> = {
  applypatch: { title: 'Apply Patch', icon: 'difference' },
  bash: { title: 'Bash', icon: 'terminal' },
  edit: { title: 'Edit', icon: 'edit' },
  glob: { title: 'Glob', icon: 'data_object' },
  grep: { title: 'Grep', icon: 'manage_search' },
  ls: { title: 'List Files', icon: 'folder_open' },
  notebookedit: { title: 'Notebook Edit', icon: 'grid_view' },
  read: { title: 'Read', icon: 'article' },
  task: { title: 'Task', icon: 'checklist' },
  todowrite: { title: 'Todo', icon: 'checklist' },
  webfetch: { title: 'Web Fetch', icon: 'travel_explore' },
  websearch: { title: 'Web Search', icon: 'travel_explore' },
  write: { title: 'Write', icon: 'edit_note' }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const humanizeSegment = (value: string) => (
  value
    .replace(/[_:-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
)

export const formatToolName = (name: string) => {
  if (name.startsWith('mcp__ChromeDevtools__')) {
    return name.replace('mcp__ChromeDevtools__', '')
  }

  const namespaceSegments = name.includes('__') ? name.split('__').filter(Boolean) : []
  const lastSegment = namespaceSegments.length > 0
    ? namespaceSegments[namespaceSegments.length - 1]
    : name.split(':').pop() ?? name
  return humanizeSegment(lastSegment)
}

export const normalizeToolKey = (name: string) => (
  formatToolName(name).replace(/[^a-z0-9]+/gi, '').toLowerCase()
)

export const resolveToolMeta = (name: string) => {
  const normalizedKey = normalizeToolKey(name)
  const mapped = TOOL_ICON_MAP[normalizedKey]
  if (mapped != null) {
    return mapped
  }

  return {
    title: formatToolName(name) || name,
    icon: 'build'
  }
}

export const resolveToolPrimaryText = (input: unknown) => {
  if (!isRecord(input)) {
    return undefined
  }

  for (const key of PRIMARY_KEYS) {
    const value = input[key]
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim().split('\n')[0]
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const trimmed = value.trim().split('\n')[0]
      if (PATH_KEYS.has(key)) {
        return trimmed
      }
      return trimmed
    }
  }

  return undefined
}

export const buildToolViewTextFallback = (summary: ToolViewSummary) => {
  const primary = summary.primary?.trim()
  return primary != null && primary !== ''
    ? `${summary.title} ${primary}`
    : summary.title
}

export const appendStatusBadge = (
  badges: ToolViewBadge[] | undefined,
  summaryStatus: ToolViewSummary['status']
) => {
  if (summaryStatus == null || summaryStatus === 'pending') {
    return badges
  }

  const statusLabel = summaryStatus === 'error'
    ? 'Error'
    : summaryStatus === 'running'
    ? 'Running'
    : 'Success'

  return [...(badges ?? []), {
    label: statusLabel,
    tone: summaryStatus === 'error'
      ? 'error'
      : summaryStatus === 'running'
      ? 'warning'
      : 'default'
  }]
}
