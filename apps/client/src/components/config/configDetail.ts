/* eslint-disable max-lines -- detail route helpers intentionally keep path parsing and metadata resolution together */
import type { DetailCollectionContext, FieldSpec } from './configSchema'
import { configSchema } from './configSchema'
import { getFieldLabel, getValueByPath } from './configUtils'
import type { TranslationFn } from './configUtils'

export interface ConfigDetailRoute {
  kind: 'detailCollectionItem'
  fieldPath: string[]
  itemKey: string
}

export interface DetailCollectionEntry {
  key: string
  item: Record<string, unknown>
  index: number
}

export interface ConfigDetailRouteMeta {
  field: FieldSpec
  fieldLabel: string
  item: Record<string, unknown>
  itemLabel: string
  itemKey: string
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

export const toDetailCollectionEntries = ({
  field,
  value
}: {
  field: FieldSpec
  value: unknown
}): DetailCollectionEntry[] => {
  const detailCollection = field.detailCollection
  if (field.type !== 'detailCollection' || detailCollection == null) return []

  if (detailCollection.collectionKind === 'list') {
    const items = Array.isArray(value)
      ? value.filter(isRecordObject)
      : []
    return items.map((item, index) => ({
      key: String(index),
      item,
      index
    }))
  }

  if (detailCollection.collectionKind === 'recordMap') {
    const source = isRecordObject(value) ? value : {}
    return Object.entries(source).map(([itemKey, item], index) => ({
      key: itemKey,
      item: isRecordObject(item) ? item : detailCollection.createItem?.(itemKey) ?? {},
      index
    }))
  }

  const source = isRecordObject(value) ? value : {}
  return detailCollection.itemKeys.map((itemKey, index) => {
    const existing = source[itemKey]
    const item = isRecordObject(existing)
      ? existing
      : detailCollection.createItem?.(itemKey) ?? {}
    return {
      key: itemKey,
      item,
      index
    }
  })
}

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
    : `${route.kind}:${route.fieldPath.join('.')}:${route.itemKey}`
)

export const serializeConfigDetailRoute = (route: ConfigDetailRoute | null) => (
  route == null
    ? ''
    : route.fieldPath.length === 0
    ? encodeURIComponent(route.itemKey)
    : [...route.fieldPath, route.itemKey].map(segment => encodeURIComponent(segment)).join('/')
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
  if (segments.length < 1) return null

  const detailField = fields
    .filter(field => field.type === 'detailCollection' && field.detailCollection != null)
    .sort((left, right) => right.path.length - left.path.length)
    .find((field) => {
      if (segments.length !== field.path.length + 1) return false
      if (!field.path.every((segment, index) => segment === segments[index])) return false
      const itemKey = segments[field.path.length] ?? ''
      if (itemKey === '') return false
      if (field.detailCollection?.collectionKind === 'list') return /^\d+$/.test(itemKey)
      return true
    })
  if (detailField == null) return null

  return {
    kind: 'detailCollectionItem',
    fieldPath: detailField.path,
    itemKey: segments[detailField.path.length]!
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
  detailContext: DetailCollectionContext
  t: TranslationFn
}): ConfigDetailRouteMeta | null => {
  if (route == null) return null
  if (route.kind !== 'detailCollectionItem') return null

  const resolvedFields = getSectionFields(sectionKey, fields)
  const field = findFieldByPath(resolvedFields, route.fieldPath)
  if (field?.type !== 'detailCollection' || field.detailCollection == null) {
    return null
  }

  const itemEntries = toDetailCollectionEntries({
    field,
    value: getValueByPath(value, field.path)
  })
  const entry = itemEntries.find(item => item.key === route.itemKey)
  if (entry == null) return null

  const fieldLabel = getFieldDisplayLabel({ field, sectionKey, t })
  const itemLabel = field.detailCollection.getBreadcrumbLabel?.(
    entry.item,
    entry.key,
    entry.index,
    detailContext
  ) ?? field.detailCollection.getItemTitle(
    entry.item,
    entry.key,
    entry.index,
    detailContext
  )

  return {
    field,
    fieldLabel,
    item: entry.item,
    itemLabel,
    itemKey: entry.key,
    itemIndex: entry.index
  }
}
