import type { ConfiguredSkillInstallConfig } from '@vibe-forge/types'

import { toSkillSlug } from '../skills-cli'
import { normalizeNonEmptyString } from './shared'
import type { NormalizedProjectSkillInstall } from './types'

const parseStringInstall = (value: string): Omit<NormalizedProjectSkillInstall, 'targetDirName' | 'targetName'> => {
  const ref = value.trim()
  const atIndex = ref.lastIndexOf('@')
  if (atIndex > 0 && atIndex < ref.length - 1) {
    return {
      ref,
      source: ref.slice(0, atIndex),
      name: ref.slice(atIndex + 1)
    }
  }

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

export const normalizeProjectSkillInstall = (
  value: string | ConfiguredSkillInstallConfig
): NormalizedProjectSkillInstall | undefined => {
  if (typeof value === 'string') {
    const parsed = parseStringInstall(value)
    const targetName = parsed.name.trim()
    const targetDirName = toSkillSlug(targetName)
    if (targetDirName === '') return undefined
    return {
      ...parsed,
      targetName,
      targetDirName
    }
  }

  const name = normalizeNonEmptyString(value.name)
  if (name == null) return undefined
  const source = normalizeNonEmptyString(value.source)
  const rename = normalizeNonEmptyString(value.rename)
  const targetName = rename ?? name
  const targetDirName = toSkillSlug(targetName)
  if (targetDirName === '') return undefined

  return {
    ref: source == null ? name : `${source}@${name}`,
    name,
    ...(source == null ? {} : { source }),
    ...(rename == null ? {} : { rename }),
    targetName,
    targetDirName
  }
}
