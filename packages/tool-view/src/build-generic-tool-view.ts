import type {
  ToolPresentationInput,
  ToolView,
  ToolViewArtifact,
  ToolViewEnvelope,
  ToolViewField,
  ToolViewSection,
  ToolViewSummary
} from '@vibe-forge/types'

import { buildToolViewTextFallback, resolveToolMeta, resolveToolPrimaryText } from './tool-view-summary'

const INLINE_FIELD_LIMIT = 4
const INLINE_KEYS = new Set(['cwd', 'path', 'file_path', 'url', 'pattern', 'query', 'timeout', 'workdir'])
const CODE_KEYS = new Set(['command', 'content', 'input', 'newString', 'new_string', 'oldString', 'old_string', 'output', 'patch', 'stderr', 'stdout'])
const LIST_KEYS = new Set(['changes', 'entries', 'files', 'matches', 'results', 'todos'])

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const asString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value : undefined
)

const humanizeLabel = (value: string) => {
  const humanized = value
    .replace(/[_:-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return humanized === ''
    ? value
    : `${humanized.charAt(0).toUpperCase()}${humanized.slice(1)}`
}

const looksLikeCode = (key: string, value: string) => {
  if (CODE_KEYS.has(key)) return true
  if (value.includes('*** Begin Patch')) return true
  return /[{}();=<>]|^diff --git/m.test(value)
}

const detectLanguage = (pathOrName?: string) => {
  const ext = pathOrName?.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    css: 'css',
    diff: 'diff',
    html: 'html',
    js: 'javascript',
    json: 'json',
    jsx: 'jsx',
    md: 'markdown',
    py: 'python',
    scss: 'scss',
    sh: 'bash',
    sql: 'sql',
    ts: 'typescript',
    tsx: 'tsx',
    yaml: 'yaml',
    yml: 'yaml'
  }
  return ext != null ? languageMap[ext] : undefined
}

const pushField = (
  target: ToolViewField[],
  field: ToolViewField
) => {
  const { value } = field
  if (value == null || value === '') {
    return
  }
  if (Array.isArray(value) && value.length === 0) {
    return
  }
  if (isRecord(value) && Object.keys(value).length === 0) {
    return
  }
  target.push(field)
}

const buildFieldsAndArtifacts = (params: {
  value: unknown
  artifactPrefix: string
  artifactPathHint?: string
}) => {
  const inlineFields: ToolViewField[] = []
  const detailFields: ToolViewField[] = []
  const artifacts: ToolViewArtifact[] = []
  const sections: ToolViewSection[] = []

  if (!isRecord(params.value)) {
    if (params.value == null) {
      return { inlineFields, detailFields, artifacts, sections }
    }

    const artifactId = `${params.artifactPrefix}-value`
    if (typeof params.value === 'string') {
      artifacts.push({
        id: artifactId,
        kind: looksLikeCode('value', params.value) ? 'code' : 'text',
        value: params.value,
        ...(looksLikeCode('value', params.value) ? { language: detectLanguage(params.artifactPathHint) ?? 'text' } : {})
      })
      sections.push({
        type: 'artifact',
        artifactId,
        display: looksLikeCode('value', params.value) ? 'code' : 'text'
      })
    } else if (Array.isArray(params.value)) {
      const items = params.value.map(item => String(item))
      artifacts.push({ id: artifactId, kind: 'list', items })
      sections.push({ type: 'artifact', artifactId, display: 'list' })
    } else {
      artifacts.push({ id: artifactId, kind: 'json', value: params.value })
      sections.push({ type: 'artifact', artifactId, display: 'json' })
    }
    return { inlineFields, detailFields, artifacts, sections }
  }

  const oldString = asString(params.value.oldString) ?? asString(params.value.old_string)
  const newString = asString(params.value.newString) ?? asString(params.value.new_string)
  const pathHint = asString(params.value.path) ?? asString(params.value.file_path) ?? params.artifactPathHint
  if (oldString != null && newString != null) {
    const artifactId = `${params.artifactPrefix}-diff`
    artifacts.push({
      id: artifactId,
      kind: 'diff',
      original: oldString,
      modified: newString,
      language: detectLanguage(pathHint)
    })
    sections.push({ type: 'artifact', artifactId, display: 'diff' })
  }

  for (const [key, rawValue] of Object.entries(params.value)) {
    if (rawValue == null) continue
    if (key === 'oldString' || key === 'old_string' || key === 'newString' || key === 'new_string') {
      continue
    }

    const label = humanizeLabel(key)

    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim()
      if (trimmed === '') continue

      if (inlineFields.length < INLINE_FIELD_LIMIT && !trimmed.includes('\n') && INLINE_KEYS.has(key)) {
        pushField(inlineFields, { label, value: trimmed, format: 'inline' })
        continue
      }

      if (trimmed.includes('\n') || looksLikeCode(key, trimmed)) {
        const artifactId = `${params.artifactPrefix}-${key}`
        artifacts.push({
          id: artifactId,
          kind: looksLikeCode(key, trimmed) ? 'code' : 'text',
          value: trimmed,
          ...(looksLikeCode(key, trimmed) ? { language: detectLanguage(pathHint) ?? 'text' } : {})
        })
        sections.push({
          type: 'artifact',
          artifactId,
          display: looksLikeCode(key, trimmed) ? 'code' : 'text'
        })
        continue
      }

      pushField(
        inlineFields.length < INLINE_FIELD_LIMIT
          ? inlineFields
          : detailFields,
        {
          label,
          value: trimmed,
          format: inlineFields.length < INLINE_FIELD_LIMIT ? 'inline' : 'text'
        }
      )
      continue
    }

    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      pushField(
        inlineFields.length < INLINE_FIELD_LIMIT
          ? inlineFields
          : detailFields,
        {
          label,
          value: rawValue,
          format: inlineFields.length < INLINE_FIELD_LIMIT ? 'inline' : 'text'
        }
      )
      continue
    }

    if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) continue

      if (rawValue.every(item => ['string', 'number', 'boolean'].includes(typeof item))) {
        const items = rawValue.map(item => String(item))
        if (items.length <= 3 && inlineFields.length < INLINE_FIELD_LIMIT && !LIST_KEYS.has(key)) {
          pushField(inlineFields, { label, value: items.join(', '), format: 'inline' })
          continue
        }

        const artifactId = `${params.artifactPrefix}-${key}`
        artifacts.push({ id: artifactId, kind: 'list', items })
        sections.push({ type: 'artifact', artifactId, display: 'list' })
        continue
      }

      const artifactId = `${params.artifactPrefix}-${key}`
      artifacts.push({ id: artifactId, kind: 'json', value: rawValue })
      sections.push({ type: 'artifact', artifactId, display: 'json' })
      continue
    }

    const artifactId = `${params.artifactPrefix}-${key}`
    artifacts.push({ id: artifactId, kind: 'json', value: rawValue })
    sections.push({ type: 'artifact', artifactId, display: 'json' })
  }

  if (detailFields.length > 0) {
    sections.unshift({
      type: 'fields',
      fields: detailFields
    })
  }

  return { inlineFields, detailFields, artifacts, sections }
}

const buildToolView = (params: {
  value: unknown
  artifactPrefix: string
  defaultExpanded?: boolean
  artifactPathHint?: string
}): {
  view?: ToolView
  artifacts: ToolViewArtifact[]
  inlineFields: ToolViewField[]
} => {
  const built = buildFieldsAndArtifacts(params)
  if (built.inlineFields.length === 0 && built.sections.length === 0) {
    return { artifacts: [], inlineFields: [] }
  }

  return {
    view: {
      defaultExpanded: params.defaultExpanded,
      sections: [
        ...(built.inlineFields.length > 0
          ? [{ type: 'fields', fields: built.inlineFields } satisfies ToolViewSection]
          : []),
        ...built.sections
      ]
    },
    artifacts: built.artifacts,
    inlineFields: built.inlineFields
  }
}

export const buildToolViewId = (sourceMessageId: string, toolUseId: string) => `${sourceMessageId}:${toolUseId}`

export const buildGenericToolView = (input: ToolPresentationInput): ToolViewEnvelope => {
  const meta = resolveToolMeta(input.toolUse.name)
  const callPathHint = isRecord(input.toolUse.input)
    ? asString(input.toolUse.input.path) ?? asString(input.toolUse.input.file_path)
    : undefined
  const call = buildToolView({
    value: input.toolUse.input,
    artifactPrefix: `${input.toolUse.id}-call`,
    defaultExpanded: false,
    artifactPathHint: callPathHint
  })
  const result = input.toolResult == null
    ? { artifacts: [], inlineFields: [] }
    : buildToolView({
      value: input.toolResult.content,
      artifactPrefix: `${input.toolUse.id}-result`,
      defaultExpanded: true,
      artifactPathHint: callPathHint
    })

  const summaryStatus = input.toolResult == null
    ? 'pending'
    : input.toolResult.is_error === true
    ? 'error'
    : 'success'

  const summary: ToolViewSummary = {
    title: meta.title,
    icon: meta.icon,
    primary: resolveToolPrimaryText(input.toolUse.input),
    status: summaryStatus
  }

  return {
    version: 1,
    toolViewId: buildToolViewId(input.sourceMessageId, input.toolUse.id),
    sourceMessageId: input.sourceMessageId,
    toolUseId: input.toolUse.id,
    revision: input.toolResult == null ? 1 : 2,
    summary,
    call: call.view,
    result: result.view,
    artifacts: [...call.artifacts, ...result.artifacts],
    textFallback: buildToolViewTextFallback(summary)
  }
}
