export type EditorValueType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export type TranslationFn = (key: string, options?: { defaultValue?: string }) => string

export const isEmptyValue = (value: unknown) => {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

export const cloneValue = (value: unknown) => {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value)) as unknown
}

export const getValueType = (value: unknown): EditorValueType => {
  if (Array.isArray(value)) return 'array'
  if (value != null && typeof value === 'object') return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

export const getTypeIcon = (valueType: EditorValueType) => {
  if (valueType === 'string') return 'text_fields'
  if (valueType === 'number') return 'numbers'
  if (valueType === 'boolean') return 'toggle_on'
  if (valueType === 'array') return 'view_list'
  return 'account_tree'
}

export const getFieldLabel = (
  t: TranslationFn,
  sectionKey: string,
  path: string[],
  fallback: string
) => {
  if (path.length === 0) return fallback
  const key = `config.fields.${sectionKey}.${path.join('.')}.label`
  return t(key, { defaultValue: fallback })
}

export const getFieldDescription = (
  t: TranslationFn,
  sectionKey: string,
  path: string[]
) => {
  if (path.length === 0) return ''
  const key = `config.fields.${sectionKey}.${path.join('.')}.desc`
  return t(key, { defaultValue: '' })
}

export const isSensitiveKey = (key: string) => /key|token|secret|password/i.test(key)

export const getValueByPath = (value: unknown, path: string[]) => {
  if (path.length === 0) return value
  let current = value
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export const setValueByPath = (value: unknown, path: string[], nextValue: unknown) => {
  if (path.length === 0) return nextValue
  const root = (value != null && typeof value === 'object' && !Array.isArray(value))
    ? { ...(value as Record<string, unknown>) }
    : {}
  let current: Record<string, unknown> = root
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const existing = current[key]
    const next = (existing != null && typeof existing === 'object' && !Array.isArray(existing))
      ? { ...(existing as Record<string, unknown>) }
      : {}
    current[key] = next
    current = next
  }
  current[path[path.length - 1]] = nextValue
  return root
}
