import type { ConfiguredSkillInstallConfig } from '@vibe-forge/types'

import { toSkillSlug } from '../skills-cli'
import { formatSkillsSpec, parseSkillsSpec } from '../skills-spec'
import { normalizeNonEmptyString } from './shared'
import type { NormalizedProjectSkillInstall } from './types'

export const normalizeProjectSkillInstall = (
  value: string | ConfiguredSkillInstallConfig
): NormalizedProjectSkillInstall | undefined => {
  if (typeof value === 'string') {
    const parsed = parseSkillsSpec(value)
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
  const registry = normalizeNonEmptyString(value.registry)
  const source = normalizeNonEmptyString(value.source)
  const version = normalizeNonEmptyString(value.version)
  const rename = normalizeNonEmptyString(value.rename)
  const targetName = rename ?? name
  const targetDirName = toSkillSlug(targetName)
  if (targetDirName === '') return undefined

  return {
    ref: formatSkillsSpec({
      name,
      registry,
      source,
      version
    }),
    name,
    ...(registry == null ? {} : { registry }),
    ...(source == null ? {} : { source }),
    ...(version == null ? {} : { version }),
    ...(rename == null ? {} : { rename }),
    targetName,
    targetDirName
  }
}
