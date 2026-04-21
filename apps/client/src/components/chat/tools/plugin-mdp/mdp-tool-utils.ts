import type { ToolFieldView } from '../core/tool-field-sections'

const MDP_TOOL_KINDS = ['listClients', 'listPaths', 'callPath', 'callPaths'] as const

export type MdpToolKind = (typeof MDP_TOOL_KINDS)[number]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export const resolveMdpToolKind = (name: string): MdpToolKind | undefined => {
  for (const kind of MDP_TOOL_KINDS) {
    if (
      name === `MDP:${kind}` ||
      name === `mcp__MDP__${kind}` ||
      name.endsWith(`:MDP:${kind}`)
    ) {
      return kind
    }
  }

  return undefined
}

export const isMdpToolName = (name: string) => resolveMdpToolKind(name) != null

export const extractMdpToolPayload = (content: unknown): unknown => {
  if (typeof content === 'string') {
    return safeJsonParse(content) ?? content
  }

  if (!isRecord(content)) {
    return content
  }

  if ('structuredContent' in content && content.structuredContent != null) {
    return content.structuredContent
  }

  const structuredBlocks = Array.isArray(content.content) ? content.content : undefined
  if (structuredBlocks != null) {
    for (const block of structuredBlocks) {
      if (!isRecord(block) || block.type !== 'text') continue
      const parsed = typeof block.text === 'string' ? safeJsonParse(block.text) : undefined
      if (parsed !== undefined) {
        return parsed
      }
    }
  }

  return content
}

const getQuerySearch = (input: Record<string, unknown>) => {
  const direct = asString(input.search)
  if (direct !== '') {
    return direct
  }

  const query = input.query
  if (!isRecord(query)) {
    return undefined
  }

  const nested = asString(query.search)
  return nested === '' ? undefined : nested
}

const getMethodPathTarget = (input: Record<string, unknown>) => {
  const method = asString(input.method)
  const path = asString(input.path)
  if (method === '' && path === '') {
    return undefined
  }
  return [method || undefined, path || undefined].filter(Boolean).join(' ')
}

export const getMdpToolTarget = (kind: MdpToolKind, input: unknown) => {
  if (!isRecord(input)) {
    return undefined
  }

  if (kind === 'callPath' || kind === 'callPaths') {
    return getMethodPathTarget(input)
  }

  const search = getQuerySearch(input)
  if (search != null) {
    return search
  }

  const methodPath = getMethodPathTarget(input)
  if (methodPath != null) {
    return methodPath
  }

  const clientId = asString(input.clientId)
  if (clientId !== '') {
    return clientId
  }

  if (Array.isArray(input.clientIds) && input.clientIds.length === 1) {
    const first = asString(input.clientIds[0])
    return first === '' ? undefined : first
  }

  return undefined
}

const pushField = (
  fields: ToolFieldView[],
  labelKey: string,
  fallbackLabel: string,
  value: unknown
) => {
  if (
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0)
  ) {
    return
  }

  const format = Array.isArray(value)
    ? 'list'
    : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? 'inline'
    : 'json'

  fields.push({
    labelKey,
    fallbackLabel,
    format,
    value
  })
}

const splitHeaderDisplay = (headers: unknown) => {
  if (!isRecord(headers)) {
    return {
      visible: headers,
      hidden: undefined
    }
  }

  const entries = Object.entries(headers).filter(([, value]) => (
    value != null && value !== ''
  ))

  if (entries.length === 1) {
    const [rawKey, rawValue] = entries[0]
    const key = rawKey.trim().toLowerCase()
    const value = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : rawValue
    if (key === 'content-type' && value === 'application/json') {
      return {
        visible: undefined,
        hidden: headers
      }
    }
  }

  return {
    visible: headers,
    hidden: undefined
  }
}

const getDisplayBody = (body: unknown) => {
  if (typeof body !== 'string') {
    return body
  }

  return safeJsonParse(body) ?? body
}

export const buildMdpRequestFields = (input: unknown) => {
  if (!isRecord(input)) {
    return {
      inlineFields: [] as ToolFieldView[],
      lineFields: [] as ToolFieldView[],
      blockFields: [] as ToolFieldView[],
      hiddenBlockFields: [] as ToolFieldView[]
    }
  }

  const inlineFields: ToolFieldView[] = []
  const lineFields: ToolFieldView[] = []
  const blockFields: ToolFieldView[] = []
  const hiddenBlockFields: ToolFieldView[] = []

  pushField(lineFields, 'chat.tools.fields.clientId', 'Client', asString(input.clientId) || undefined)
  if (Array.isArray(input.clientIds)) {
    const clientIds = input.clientIds.map(value => asString(value)).filter(value => value !== '')
    pushField(
      lineFields,
      'chat.tools.fields.clientIds',
      'Clients',
      clientIds.length <= 3 ? clientIds.join(', ') : clientIds
    )
  }
  pushField(inlineFields, 'chat.tools.fields.method', 'Method', asString(input.method) || undefined)
  pushField(inlineFields, 'chat.tools.fields.path', 'Path', asString(input.path) || undefined)
  pushField(inlineFields, 'chat.tools.fields.search', 'Search', getQuerySearch(input))

  if ('body' in input) {
    pushField(hiddenBlockFields, 'chat.tools.fields.body', 'Body', getDisplayBody(input.body))
  }

  if ('headers' in input) {
    const headers = splitHeaderDisplay(input.headers)
    pushField(blockFields, 'chat.tools.fields.headers', 'Headers', headers.visible)
    pushField(hiddenBlockFields, 'chat.tools.fields.headers', 'Headers', headers.hidden)
  }

  return { inlineFields, lineFields, blockFields, hiddenBlockFields }
}

export const getMdpClientRoute = (metadata: unknown) => {
  if (!isRecord(metadata)) {
    return undefined
  }

  const pathname = asString(metadata.currentRoute)
  const search = asString(metadata.currentSearch)
  if (pathname === '' && search === '') {
    return undefined
  }

  return `${pathname || '/'}${search}`
}

export const getMdpCallStatus = (payload: unknown) => {
  if (!isRecord(payload) || typeof payload.ok !== 'boolean') {
    return undefined
  }

  return payload.ok
}
