import type { ConfigSections } from './sections'
import type { ConfigPathSegment, ResolvedConfigSectionPath } from './section-path'

const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
)

export const getConfigSectionValueAtPath = (
  sections: ConfigSections,
  resolvedPath: ResolvedConfigSectionPath
) => {
  let current: unknown = sections[resolvedPath.section]
  if (resolvedPath.sectionPath.length === 0) {
    return {
      exists: true as const,
      value: current
    }
  }

  for (const segment of resolvedPath.sectionPath) {
    if (Array.isArray(current) && typeof segment === 'number') {
      if (!(segment in current)) {
        return {
          exists: false as const,
          value: undefined
        }
      }
      current = current[segment]
      continue
    }

    if (isRecord(current) && hasOwn(current, String(segment))) {
      current = current[String(segment)]
      continue
    }

    return {
      exists: false as const,
      value: undefined
    }
  }

  return {
    exists: true as const,
    value: current
  }
}

const cloneContainerForSegment = (value: unknown, nextSegment: ConfigPathSegment) => {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (isRecord(value)) {
    return { ...value }
  }

  return typeof nextSegment === 'number' ? [] : {}
}

const setValueAtPath = (
  current: unknown,
  path: readonly ConfigPathSegment[],
  nextValue: unknown
): unknown => {
  if (path.length === 0) {
    return nextValue
  }

  const [segment, ...rest] = path
  const container = cloneContainerForSegment(current, segment)

  if (typeof segment === 'number') {
    const nextArray = Array.isArray(container) ? container : []
    nextArray[segment] = setValueAtPath(nextArray[segment], rest, nextValue)
    return nextArray
  }

  const nextRecord = isRecord(container) ? container : {}
  nextRecord[segment] = setValueAtPath(nextRecord[segment], rest, nextValue)
  return nextRecord
}

export const setConfigSectionValueAtPath = (
  sections: ConfigSections,
  resolvedPath: ResolvedConfigSectionPath,
  nextValue: unknown
) => ({
  ...sections,
  [resolvedPath.section]: setValueAtPath(
    sections[resolvedPath.section],
    resolvedPath.sectionPath,
    nextValue
  ) as ConfigSections[typeof resolvedPath.section]
})

const unsetValueAtPath = (
  current: unknown,
  path: readonly ConfigPathSegment[]
): unknown => {
  if (path.length === 0) {
    return current
  }

  const [segment, ...rest] = path
  if (typeof segment === 'number') {
    const nextArray = Array.isArray(current) ? [...current] : []
    if (rest.length === 0) {
      nextArray.splice(segment, 1)
      return nextArray
    }
    nextArray[segment] = unsetValueAtPath(nextArray[segment], rest)
    return nextArray
  }

  const nextRecord = isRecord(current) ? { ...current } : {}
  if (rest.length === 0) {
    nextRecord[segment] = undefined
    return nextRecord
  }

  nextRecord[segment] = unsetValueAtPath(nextRecord[segment], rest)
  return nextRecord
}

export const unsetConfigSectionValueAtPath = (
  sections: ConfigSections,
  resolvedPath: ResolvedConfigSectionPath
) => ({
  ...sections,
  [resolvedPath.section]: unsetValueAtPath(
    sections[resolvedPath.section],
    resolvedPath.sectionPath
  ) as ConfigSections[typeof resolvedPath.section]
})
