import { access } from 'node:fs/promises'
import process from 'node:process'

import type { ConfigSource } from '@vibe-forge/config'
import { buildConfigJsonVariables, loadConfigState } from '@vibe-forge/config'
import type { Config, ConfiguredSkillInstallConfig } from '@vibe-forge/types'
import {
  normalizeProjectSkillInstall,
  readProjectSkills,
  resolveSkillsCliRuntimeConfig,
  toSkillSlug
} from '@vibe-forge/utils'

const normalizeString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export const printResult = (value: unknown, json = false) => {
  if (json) {
    console.log(JSON.stringify(
      value != null && typeof value === 'object' && !Array.isArray(value)
        ? { ok: true, ...(value as Record<string, unknown>) }
        : { ok: true, value },
      null,
      2
    ))
    return
  }

  if (typeof value === 'string') {
    console.log(value)
    return
  }

  console.log(JSON.stringify(value, null, 2))
}

export const exitWithError = (error: unknown, json = false): never => {
  const message = error instanceof Error ? error.message : String(error)
  if (json) {
    console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  } else {
    console.error(message)
  }
  process.exit(1)
}

export const loadSkillsConfigState = async (cwd: string) => (
  await loadConfigState({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
)

export const getSourceConfig = (state: Awaited<ReturnType<typeof loadSkillsConfigState>>, source: ConfigSource) => (
  source === 'user' ? state.userConfig : state.projectConfig
)

export const buildGeneralSkillsUpdateValue = (
  sourceConfig: Config | undefined,
  nextSkills: Array<string | ConfiguredSkillInstallConfig>
) => {
  const value: Record<string, unknown> = {
    skills: nextSkills.length === 0 ? undefined : nextSkills
  }
  const skillsCli = resolveSkillsCliRuntimeConfig(sourceConfig)
  if (skillsCli != null) {
    value.skillsCli = skillsCli
  }
  return value
}

export const isSameDeclaredSkill = (
  left: string | ConfiguredSkillInstallConfig,
  right: string | ConfiguredSkillInstallConfig
) => {
  const normalizedLeft = normalizeProjectSkillInstall(left)
  const normalizedRight = normalizeProjectSkillInstall(right)

  if (normalizedLeft != null && normalizedRight != null) {
    return normalizedLeft.ref === normalizedRight.ref &&
      normalizedLeft.targetName === normalizedRight.targetName &&
      normalizedLeft.rename === normalizedRight.rename &&
      normalizedLeft.source === normalizedRight.source
  }

  return left === right
}

export const matchesSkillSelector = (selector: string, value: string | ConfiguredSkillInstallConfig) => {
  const normalized = normalizeProjectSkillInstall(value)
  if (normalized == null) return false

  const trimmedSelector = selector.trim()
  const selectorSlug = toSkillSlug(trimmedSelector)
  return (
    trimmedSelector === normalized.ref ||
    trimmedSelector === normalized.name ||
    trimmedSelector === normalized.targetName ||
    trimmedSelector === normalized.targetDirName ||
    selectorSlug === normalized.targetDirName ||
    selectorSlug === toSkillSlug(normalized.name) ||
    selectorSlug === toSkillSlug(normalized.targetName)
  )
}

export const resolveInstalledSkillDirNames = async (workspaceFolder: string, selector: string) => {
  const trimmedSelector = selector.trim()
  const selectorSlug = toSkillSlug(trimmedSelector)
  const skills = await readProjectSkills(workspaceFolder)
  return skills
    .filter(skill => (
      skill.dirName === trimmedSelector ||
      skill.name === trimmedSelector ||
      skill.dirName === selectorSlug ||
      toSkillSlug(skill.name) === selectorSlug
    ))
    .map(skill => skill.dirName)
}

export { normalizeString, pathExists }
