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
  localIndex?: number
  resolvedIndex?: number
  source: 'local' | 'inherited'
  localItem?: Record<string, unknown>
  resolvedItem: Record<string, unknown>
  hasResolvedOverlay: boolean
}

export interface ConfigDetailRouteMeta {
  field: FieldSpec
  fieldLabel: string
  item: Record<string, unknown>
  resolvedItem: Record<string, unknown>
  itemLabel: string
  itemKey: string
  itemIndex: number
  localItemIndex?: number
  resolvedItemIndex?: number
  itemSource: 'local' | 'inherited'
  hasResolvedOverlay: boolean
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

const isSameConfigValue = (left: unknown, right: unknown) => (
  JSON.stringify(left) === JSON.stringify(right)
)

export const getSectionFields = (sectionKey: string, providedFields?: FieldSpec[]) => (
  providedFields ?? configSchema[sectionKey] ?? []
)

export const toDetailCollectionEntries = ({
  field,
  value,
  resolvedValue
}: {
  field: FieldSpec
  value: unknown
  resolvedValue?: unknown
}): DetailCollectionEntry[] => {
  const detailCollection = field.detailCollection
  if (field.type !== 'detailCollection' || detailCollection == null) return []

  if (detailCollection.collectionKind === 'list') {
    const localItems = Array.isArray(value)
      ? value.filter(isRecordObject)
      : []
    const resolvedItems = Array.isArray(resolvedValue)
      ? resolvedValue.filter(isRecordObject)
      : localItems
    const getMergeKey = detailCollection.getMergeKey

    if (getMergeKey != null) {
      const localIndexesByKey = new Map<string, number[]>()
      localItems.forEach((item, localIndex) => {
        const mergeKey = getMergeKey(item)
        if (mergeKey == null || mergeKey === '') return
        const existing = localIndexesByKey.get(mergeKey) ?? []
        existing.push(localIndex)
        localIndexesByKey.set(mergeKey, existing)
      })

      const matchedLocalIndexes = new Set<number>()
      const entries: DetailCollectionEntry[] = resolvedItems.map((resolvedItem, resolvedIndex) => {
        const mergeKey = getMergeKey(resolvedItem)
        const matchedIndex = mergeKey != null
          ? localIndexesByKey.get(mergeKey)?.shift()
          : undefined
        if (matchedIndex == null) {
          return {
            key: String(resolvedIndex),
            item: resolvedItem,
            index: resolvedIndex,
            resolvedIndex,
            source: 'inherited',
            resolvedItem,
            hasResolvedOverlay: false
          }
        }

        const localItem = localItems[matchedIndex]!
        matchedLocalIndexes.add(matchedIndex)
        return {
          key: String(resolvedIndex),
          item: localItem,
          index: resolvedIndex,
          localIndex: matchedIndex,
          resolvedIndex,
          source: 'local',
          localItem,
          resolvedItem,
          hasResolvedOverlay: !isSameConfigValue(localItem, resolvedItem)
        }
      })

      localItems.forEach((localItem, localIndex) => {
        if (matchedLocalIndexes.has(localIndex)) return
        const index = entries.length
        entries.push({
          key: String(index),
          item: localItem,
          index,
          localIndex,
          source: 'local',
          localItem,
          resolvedItem: localItem,
          hasResolvedOverlay: false
        })
      })

      return entries
    }

    const inheritedCount = Math.max(resolvedItems.length - localItems.length, 0)
    const inheritedEntries = resolvedItems.slice(0, inheritedCount).map((item, index) => ({
      key: String(index),
      item,
      index,
      resolvedIndex: index,
      source: 'inherited' as const,
      resolvedItem: item,
      hasResolvedOverlay: false
    }))
    const localEntries = localItems.map((item, localIndex) => {
      const resolvedIndex = inheritedCount + localIndex
      const resolvedItem = resolvedItems[resolvedIndex]
      const normalizedResolvedItem = isRecordObject(resolvedItem) ? resolvedItem : item
      return {
        key: String(resolvedIndex),
        item,
        index: resolvedIndex,
        localIndex,
        resolvedIndex,
        source: 'local' as const,
        localItem: item,
        resolvedItem: normalizedResolvedItem,
        hasResolvedOverlay: !isSameConfigValue(item, normalizedResolvedItem)
      }
    })
    return [...inheritedEntries, ...localEntries]
  }

  if (detailCollection.collectionKind === 'recordMap') {
    const localSource = isRecordObject(value) ? value : {}
    const resolvedSource = isRecordObject(resolvedValue) ? resolvedValue : localSource
    const resolvedKeys = Object.keys(resolvedSource)
    const entries = resolvedKeys.map((itemKey, index) => {
      const localItemValue = localSource[itemKey]
      const localItem = isRecordObject(localItemValue)
        ? localItemValue
        : undefined
      const resolvedItemValue = resolvedSource[itemKey]
      const resolvedItem = isRecordObject(resolvedItemValue)
        ? resolvedItemValue
        : detailCollection.createItem?.(itemKey) ?? {}
      if (localItem == null) {
        return {
          key: itemKey,
          item: resolvedItem,
          index,
          resolvedIndex: index,
          source: 'inherited' as const,
          resolvedItem,
          hasResolvedOverlay: false
        }
      }

      return {
        key: itemKey,
        item: localItem,
        index,
        resolvedIndex: index,
        source: 'local' as const,
        localItem,
        resolvedItem,
        hasResolvedOverlay: !isSameConfigValue(localItem, resolvedItem)
      }
    })
    const localOnlyEntries = Object.keys(localSource)
      .filter(itemKey => !Object.hasOwn(resolvedSource, itemKey))
      .map((itemKey, localOnlyIndex) => {
        const localItemValue = localSource[itemKey]
        const localItem = isRecordObject(localItemValue)
          ? localItemValue
          : detailCollection.createItem?.(itemKey) ?? {}
        return {
          key: itemKey,
          item: localItem,
          index: entries.length + localOnlyIndex,
          source: 'local' as const,
          localItem,
          resolvedItem: localItem,
          hasResolvedOverlay: false
        }
      })
    return [...entries, ...localOnlyEntries]
  }

  const localSource = isRecordObject(value) ? value : {}
  const resolvedSource = isRecordObject(resolvedValue) ? resolvedValue : localSource
  return detailCollection.itemKeys.map((itemKey, index) => {
    const localItemValue = localSource[itemKey]
    const resolvedItemValue = resolvedSource[itemKey]
    const localItem = isRecordObject(localItemValue)
      ? localItemValue
      : undefined
    const resolvedItem = isRecordObject(resolvedItemValue)
      ? resolvedItemValue
      : detailCollection.createItem?.(itemKey) ?? {}
    return {
      key: itemKey,
      item: localItem ?? resolvedItem,
      index,
      resolvedIndex: index,
      source: localItem != null ? 'local' as const : 'inherited' as const,
      localItem,
      resolvedItem,
      hasResolvedOverlay: localItem != null && !isSameConfigValue(localItem, resolvedItem)
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
  resolvedValue,
  route,
  detailContext,
  t
}: {
  sectionKey: string
  fields?: FieldSpec[]
  value: unknown
  resolvedValue?: unknown
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
    value: getValueByPath(value, field.path),
    resolvedValue: getValueByPath(resolvedValue ?? value, field.path)
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
    resolvedItem: entry.resolvedItem,
    itemLabel,
    itemKey: entry.key,
    itemIndex: entry.index,
    localItemIndex: entry.localIndex,
    resolvedItemIndex: entry.resolvedIndex,
    itemSource: entry.source,
    hasResolvedOverlay: entry.hasResolvedOverlay
  }
}
