import { access } from 'node:fs/promises'
import process from 'node:process'

import type { Config, ConfiguredSkillInstallConfig, SkillsCliConfig } from '@vibe-forge/types'
import {
  installProjectSkill,
  normalizeProjectSkillInstall,
  resolveConfiguredSkillInstalls as resolveDeclaredConfiguredSkillInstalls,
  resolveProjectAiPath,
  resolveSkillsCliRuntimeConfig
} from '@vibe-forge/utils'
import type { NormalizedProjectSkillInstall } from '@vibe-forge/utils'

const resolveConfiguredSkillsCliConfig = (configs: [Config?, Config?]) => {
  const [projectConfig, userConfig] = configs
  const merged = {
    ...(resolveSkillsCliRuntimeConfig(projectConfig) ?? {}),
    ...(resolveSkillsCliRuntimeConfig(userConfig) ?? {})
  } satisfies SkillsCliConfig

  return Object.keys(merged).length === 0 ? undefined : merged
}

const resolveConfiguredSkillInstalls = (configs: [Config?, Config?]) => (
  [
    ...resolveDeclaredConfiguredSkillInstalls(configs[0]?.skills),
    ...resolveDeclaredConfiguredSkillInstalls(configs[1]?.skills)
  ]
    .map((item) => normalizeProjectSkillInstall(item as string | ConfiguredSkillInstallConfig))
    .filter((item): item is NormalizedProjectSkillInstall => item != null)
)

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const ensureUniqueTargets = (skills: NormalizedProjectSkillInstall[]) => {
  const seen = new Map<string, string>()

  for (const skill of skills) {
    const previous = seen.get(skill.targetDirName)
    if (previous != null) {
      throw new Error(
        `Configured skills "${previous}" and "${skill.ref}" resolve to the same target "${skill.targetDirName}"`
      )
    }
    seen.set(skill.targetDirName, skill.ref)
  }
}

export const ensureConfiguredProjectSkills = async (params: {
  configs: [Config?, Config?]
  updateInstalledSkills?: boolean
  workspaceFolder: string
}) => {
  const installs = resolveConfiguredSkillInstalls(params.configs)
  if (installs.length === 0) {
    return []
  }

  ensureUniqueTargets(installs)

  const skillsCliConfig = resolveConfiguredSkillsCliConfig(params.configs)
  const ensured: Array<{ dirName: string; skillPath: string }> = []

  for (const skill of installs) {
    const skillPath = resolveProjectAiPath(
      params.workspaceFolder,
      process.env,
      'skills',
      skill.targetDirName,
      'SKILL.md'
    )
    if (params.updateInstalledSkills !== true && await pathExists(skillPath)) {
      ensured.push({
        dirName: skill.targetDirName,
        skillPath
      })
      continue
    }

    ensured.push(
      await installProjectSkill({
        config: skillsCliConfig,
        force: true,
        registry: undefined,
        skill,
        workspaceFolder: params.workspaceFolder
      })
    )
  }

  return ensured
}
