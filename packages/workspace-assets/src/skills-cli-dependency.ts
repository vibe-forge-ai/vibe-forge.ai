import { mkdir, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { Config } from '@vibe-forge/types'
import { findSkillsCli, installSkillsCliRefToTemp, installSkillsCliSkillToTemp } from '@vibe-forge/utils/skills-cli'

import type { NormalizedSkillDependency } from './skill-dependencies'
import {
  buildInstallDir,
  copyRegularFiles,
  pathExists,
  pickSearchResult,
  withInstallLock
} from './skills-cli-dependency-helpers'

const resolveAutoDownloadDependenciesEnabled = (
  projectConfig: Config | undefined,
  userConfig: Config | undefined
) => userConfig?.skills?.autoDownloadDependencies ?? projectConfig?.skills?.autoDownloadDependencies ?? true

export const installSkillsCliDependency = async (params: {
  cwd: string
  configs: [Config?, Config?]
  dependency: NormalizedSkillDependency
}) => {
  const [projectConfig, userConfig] = params.configs
  const autoDownloadDependenciesEnabled = resolveAutoDownloadDependenciesEnabled(projectConfig, userConfig)
  const resolvedTarget = await (async () => {
    if (params.dependency.source != null) {
      return {
        skill: params.dependency.name,
        source: params.dependency.source
      }
    }

    if (!autoDownloadDependenciesEnabled) {
      throw new Error(
        `Skill dependency automatic downloads are disabled; cannot resolve ${params.dependency.ref} without a source`
      )
    }

    return await (async () => {
      const searchResults = await findSkillsCli({
        registry: params.dependency.registry,
        query: params.dependency.name
      })
      const selected = pickSearchResult(searchResults, params.dependency.name)
      if (selected == null) {
        throw new Error(`Skill ${params.dependency.name} was not found by the skills CLI search.`)
      }

      return {
        installRef: selected.installRef,
        skill: selected.skill,
        source: selected.source
      }
    })()
  })()

  const installDir = buildInstallDir({
    cwd: params.cwd,
    registry: params.dependency.registry,
    skill: resolvedTarget.skill,
    source: resolvedTarget.source,
    version: params.dependency.version
  })
  const skillPath = resolve(installDir, 'SKILL.md')

  return await withInstallLock(`${installDir}.lock`, async () => {
    if (await pathExists(skillPath)) {
      return {
        installDir,
        skillPath
      }
    }

    if (!autoDownloadDependenciesEnabled) {
      throw new Error(`Skill dependency automatic downloads are disabled; cache not found for ${params.dependency.ref}`)
    }

    const tempInstallDir = `${installDir}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await rm(tempInstallDir, { recursive: true, force: true })
    await mkdir(tempInstallDir, { recursive: true })

    const installResult = 'installRef' in resolvedTarget
      ? params.dependency.version == null
        ? await installSkillsCliRefToTemp({
          installRef: resolvedTarget.installRef,
          registry: params.dependency.registry
        })
        : await installSkillsCliSkillToTemp({
          registry: params.dependency.registry,
          skill: resolvedTarget.skill,
          source: resolvedTarget.source,
          version: params.dependency.version
        })
      : await installSkillsCliSkillToTemp({
        registry: params.dependency.registry,
        skill: resolvedTarget.skill,
        source: resolvedTarget.source,
        version: params.dependency.version
      })

    try {
      await copyRegularFiles(installResult.installedSkill.sourcePath, tempInstallDir)
      if (!await pathExists(resolve(tempInstallDir, 'SKILL.md'))) {
        throw new Error(`Skill dependency ${params.dependency.ref} did not include SKILL.md`)
      }

      await rm(installDir, { recursive: true, force: true })
      await rename(tempInstallDir, installDir)
    } catch (error) {
      await rm(tempInstallDir, { recursive: true, force: true })
      throw error
    } finally {
      await rm(installResult.tempDir, { recursive: true, force: true })
    }

    return {
      installDir,
      skillPath
    }
  })
}
