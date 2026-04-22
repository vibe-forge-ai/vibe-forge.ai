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
  resolveConfiguredSkillsCliConfig,
  withInstallLock
} from './skills-cli-dependency-helpers'

export const installSkillsCliDependency = async (params: {
  cwd: string
  configs: [Config?, Config?]
  dependency: NormalizedSkillDependency
}) => {
  const config = resolveConfiguredSkillsCliConfig(params.configs)
  const resolvedTarget = params.dependency.source != null
    ? {
      skill: params.dependency.name,
      source: params.dependency.source
    }
    : await (async () => {
      const searchResults = await findSkillsCli({
        config,
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

  const installDir = buildInstallDir({
    config,
    cwd: params.cwd,
    skill: resolvedTarget.skill,
    source: resolvedTarget.source
  })
  const skillPath = resolve(installDir, 'SKILL.md')

  return await withInstallLock(`${installDir}.lock`, async () => {
    if (await pathExists(skillPath)) {
      return {
        installDir,
        skillPath
      }
    }

    const tempInstallDir = `${installDir}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await rm(tempInstallDir, { recursive: true, force: true })
    await mkdir(tempInstallDir, { recursive: true })

    const installResult = 'installRef' in resolvedTarget
      ? await installSkillsCliRefToTemp({
        config,
        installRef: resolvedTarget.installRef
      })
      : await installSkillsCliSkillToTemp({
        config,
        skill: resolvedTarget.skill,
        source: resolvedTarget.source
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
