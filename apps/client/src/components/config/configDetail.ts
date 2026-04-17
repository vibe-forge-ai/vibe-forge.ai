import type { DetailListContext, FieldSpec } from './configSchema'
import { configSchema } from './configSchema'
import { getFieldLabel, getValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'

export interface ConfigDetailRoute {
  kind: 'detailListItem'
  fieldPath: string[]
  itemIndex: number
}

export interface ConfigDetailRouteMeta {
  field: FieldSpec
  fieldLabel: string
  item: Record<string, unknown>
  itemLabel: string
  itemIndex: number
}

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

const isSamePath = (left: string[], right: string[]) => (
  left.length === right.length &&
  left.every((segment, index) => segment === right[index])
)

export const getSectionFields = (sectionKey: string, providedFields?: FieldSpec[]) => (
  providedFields ?? configSchema[sectionKey] ?? []
)

export const toDetailListItems = (value: unknown) => (
  Array.isArray(value)
    ? value.filter(isRecordObject)
    : []
)

const findFieldByPath = (fields: FieldSpec[], path: string[]) => (
  fields.find(field => isSamePath(field.path, path))
)

const getFieldDisplayLabel = ({
  field,
  sectionKey,
  t
}: {
  field: FieldSpec
  sectionKey: string
  t: TranslationFn
}) => (
  field.labelKey != null
    ? t(field.labelKey)
    : getFieldLabel(t, sectionKey, field.path, field.path.at(-1) ?? sectionKey)
)

export const getConfigDetailRouteKey = (route: ConfigDetailRoute | null) => (
  route == null
    ? 'root'
    : `${route.kind}:${route.fieldPath.join('.')}:${route.itemIndex}`
)

export const serializeConfigDetailRoute = (route: ConfigDetailRoute | null) => (
  route == null
    ? ''
    : [...route.fieldPath, String(route.itemIndex)].map(segment => encodeURIComponent(segment)).join('/')
)

export const parseConfigDetailRoute = ({
  fields,
  raw
}: {
  fields: FieldSpec[]
  raw: string
}): ConfigDetailRoute | null => {
  const normalized = raw.trim()
  if (normalized === '') return null

  const segments = normalized
    .split('/')
    .map(segment => decodeURIComponent(segment).trim())
    .filter(segment => segment !== '')
  if (segments.length < 2) return null

  const detailField = fields
    .filter(field => field.type === 'detailList' && field.detailList != null)
    .sort((left, right) => right.path.length - left.path.length)
    .find(field => (
      segments.length >= field.path.length + 1 &&
      field.path.every((segment, index) => segment === segments[index]) &&
      /^\d+$/.test(segments[field.path.length] ?? '')
    ))
  if (detailField == null) return null

  return {
    kind: 'detailListItem',
    fieldPath: detailField.path,
    itemIndex: Number.parseInt(segments[detailField.path.length]!, 10)
  }
}

export const resolveConfigDetailRouteMeta = ({
  sectionKey,
  fields,
  value,
  route,
  detailContext,
  t
}: {
  sectionKey: string
  fields?: FieldSpec[]
  value: unknown
  route: ConfigDetailRoute | null
  detailContext: DetailListContext
  t: TranslationFn
}): ConfigDetailRouteMeta | null => {
  if (route == null) return null
  if (route.kind !== 'detailListItem') return null

  const resolvedFields = getSectionFields(sectionKey, fields)
  const field = findFieldByPath(resolvedFields, route.fieldPath)
  if (field?.type !== 'detailList' || field.detailList == null) {
    return null
  }

  const itemList = toDetailListItems(getValueByPath(value, field.path))
  const item = itemList[route.itemIndex]
  if (item == null) return null

  const fieldLabel = getFieldDisplayLabel({ field, sectionKey, t })
  const itemLabel = field.detailList.getBreadcrumbLabel?.(item, route.itemIndex, detailContext)
    ?? field.detailList.getItemTitle(item, route.itemIndex, detailContext)

  return {
    field,
    fieldLabel,
    item,
    itemLabel,
    itemIndex: route.itemIndex
  }
}
