import process from 'node:process'

import type { ConfiguredSkillInstallConfig } from '@vibe-forge/types'
import {
  installProjectSkill,
  normalizeProjectSkillInstall,
  resolveConfiguredSkillInstalls,
  resolveProjectAiPath
} from '@vibe-forge/utils'

import { loadSkillsConfigState, pathExists } from './shared'
import type { SkillsInstallOptions } from './types'

export const buildDeclaredSkillEntry = (
  skillArg: string,
  options: Pick<SkillsInstallOptions, 'registry' | 'rename' | 'source' | 'version'>
): string | ConfiguredSkillInstallConfig => {
  const skill = typeof skillArg === 'string' && skillArg.trim() !== '' ? skillArg.trim() : undefined
  if (skill == null) {
    throw new Error('Skill reference is required.')
  }

  const explicitRegistry = typeof options.registry === 'string' && options.registry.trim() !== ''
    ? options.registry.trim()
    : undefined
  const explicitSource = typeof options.source === 'string' && options.source.trim() !== ''
    ? options.source.trim()
    : undefined
  const explicitVersion = typeof options.version === 'string' && options.version.trim() !== ''
    ? options.version.trim()
    : undefined
  const rename = typeof options.rename === 'string' && options.rename.trim() !== ''
    ? options.rename.trim()
    : undefined
  const parsed = normalizeProjectSkillInstall(skill)
  if (parsed == null) {
    throw new Error(`Invalid skill reference "${skillArg}".`)
  }

  if (explicitSource != null && parsed.source != null) {
    throw new Error('--source cannot be used when the skill reference already includes a source.')
  }
  if (explicitRegistry != null && parsed.registry != null) {
    throw new Error('--registry cannot be used when the skill reference already includes a registry.')
  }
  if (explicitVersion != null && parsed.version != null) {
    throw new Error('--version cannot be used when the skill reference already includes a version.')
  }

  if (explicitRegistry == null && explicitSource == null && explicitVersion == null && rename == null) {
    return skill
  }

  return {
    name: parsed.name,
    ...(explicitRegistry != null
      ? { registry: explicitRegistry }
      : (parsed.registry != null ? { registry: parsed.registry } : {})),
    ...(explicitSource != null
      ? { source: explicitSource }
      : (parsed.source != null ? { source: parsed.source } : {})),
    ...(explicitVersion != null
      ? { version: explicitVersion }
      : (parsed.version != null ? { version: parsed.version } : {})),
    ...(rename != null ? { rename } : {})
  }
}

export const installDeclaredSkill = async (params: {
  force?: boolean
  registry?: string
  skill: string | ConfiguredSkillInstallConfig
  workspaceFolder: string
}) => {
  const normalized = normalizeProjectSkillInstall(params.skill)
  if (normalized == null) {
    throw new Error('Skill reference is required.')
  }

  const existingSkillPath = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'skills',
    normalized.targetDirName,
    'SKILL.md'
  )
  const hadExisting = await pathExists(existingSkillPath)
  const installed = params.force === true || !hadExisting
    ? await installProjectSkill({
      force: params.force,
      registry: params.registry,
      skill: normalized,
      workspaceFolder: params.workspaceFolder
    })
    : {
      dirName: normalized.targetDirName,
      installDir: resolveProjectAiPath(params.workspaceFolder, process.env, 'skills', normalized.targetDirName),
      name: normalized.targetName,
      ref: normalized.ref,
      skillPath: existingSkillPath
    }

  return {
    ...installed,
    skipped: params.force !== true && hadExisting
  }
}

export const resolveInstallTargets = async (params: {
  args: string[]
  options: Pick<SkillsInstallOptions, 'rename' | 'source'>
  workspaceFolder: string
}) => {
  if (params.args.length > 0) {
    if (params.args.length > 1 && (params.options.rename != null || params.options.source != null)) {
      throw new Error('--source and --rename only support a single explicit skill argument.')
    }
    return params.args.map((arg) => buildDeclaredSkillEntry(arg, params.options))
  }

  const state = await loadSkillsConfigState(params.workspaceFolder)
  const configured = resolveConfiguredSkillInstalls(state.mergedConfig.skills)
  if (configured.length === 0) {
    throw new Error('No configured skills found. Add a skill first or pass an explicit skill reference.')
  }
  return configured
}
