import { normalizeNonEmptyString } from './skills-cli/shared'

export interface ParsedSkillsSpec {
  ref: string
  name: string
  registry?: string
  source?: string
  version?: string
}

const looksLikeRegistry = (value: string) => /^[a-z][a-z\d+.-]*:\/\//i.test(value)

const parsePathLikeSpec = (ref: string): ParsedSkillsSpec => {
  const sourcePathSegments = ref.split('/').filter(segment => segment.trim() !== '')
  if (
    sourcePathSegments.length >= 3 &&
    sourcePathSegments.every(segment => !segment.includes(' '))
  ) {
    return {
      ref,
      source: sourcePathSegments.slice(0, -1).join('/'),
      name: sourcePathSegments[sourcePathSegments.length - 1]
    }
  }

  return {
    ref,
    name: ref
  }
}

export const parseSkillsSpec = (value: string): ParsedSkillsSpec => {
  const ref = value.trim()
  const segments = ref.split('@').map(segment => segment.trim())
  if (segments.includes('')) {
    return {
      ref,
      name: ref
    }
  }

  if (segments.length >= 3 && looksLikeRegistry(segments[0])) {
    const registry = normalizeNonEmptyString(segments[0])
    const name = normalizeNonEmptyString(segments[segments.length === 3 ? 2 : segments.length - 2])
    const source = normalizeNonEmptyString(
      segments.length === 3
        ? segments[1]
        : segments.slice(1, -2).join('@')
    )
    const version = normalizeNonEmptyString(segments.length === 3 ? undefined : segments[segments.length - 1])

    if (registry != null && source != null && name != null) {
      return {
        ref,
        registry,
        source,
        name,
        ...(version == null ? {} : { version })
      }
    }
  }

  if (segments.length >= 3) {
    const source = normalizeNonEmptyString(segments.slice(0, -2).join('@'))
    const name = normalizeNonEmptyString(segments[segments.length - 2])
    const version = normalizeNonEmptyString(segments[segments.length - 1])

    if (source != null && name != null && version != null) {
      return {
        ref,
        source,
        name,
        version
      }
    }
  }

  if (segments.length === 2) {
    const source = normalizeNonEmptyString(segments[0])
    const name = normalizeNonEmptyString(segments[1])
    if (source != null && name != null) {
      return {
        ref,
        source,
        name
      }
    }
  }

  return parsePathLikeSpec(ref)
}

export const formatSkillsSpec = (params: {
  name: string
  registry?: string
  source?: string
  version?: string
}) => {
  const name = normalizeNonEmptyString(params.name)
  const source = normalizeNonEmptyString(params.source)
  const registry = normalizeNonEmptyString(params.registry)
  const version = normalizeNonEmptyString(params.version)

  if (name == null) {
    throw new Error('Skill name is required.')
  }

  if (source == null) {
    return name
  }

  return [
    ...(registry == null ? [] : [registry]),
    source,
    name,
    ...(version == null ? [] : [version])
  ].join('@')
}
