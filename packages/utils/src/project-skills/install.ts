import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import type { ConfiguredSkillInstallConfig, SkillsCliConfig } from '@vibe-forge/types'

import { resolveProjectAiPath } from '../ai-path'
import { findSkillsCli, installSkillsCliRefToTemp, installSkillsCliSkillToTemp, toSkillSlug } from '../skills-cli'
import { normalizeProjectSkillInstall } from './normalize'
import { copyRegularFiles, pathExists, rewriteInstalledSkillName } from './shared'
import type { NormalizedProjectSkillInstall } from './types'

const INSTALL_LOCK_TIMEOUT_MS = 30_000
const INSTALL_LOCK_RETRY_MS = 100

const pickSearchResult = (results: Awaited<ReturnType<typeof findSkillsCli>>, name: string) => {
  const slug = toSkillSlug(name)
  return results.find(result => (
    result.skill === name ||
    toSkillSlug(result.skill) === slug
  )) ?? results[0]
}

const buildInstalledSkillResult = (params: {
  installDir: string
  normalized: NormalizedProjectSkillInstall
}) => ({
  dirName: params.normalized.targetDirName,
  installDir: params.installDir,
  name: params.normalized.targetName,
  ref: params.normalized.ref,
  skillPath: join(params.installDir, 'SKILL.md')
})

const withInstallLock = async <T>(lockDir: string, callback: () => Promise<T>) => {
  const start = Date.now()
  await mkdir(dirname(lockDir), { recursive: true })

  while (true) {
    try {
      await mkdir(lockDir)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() - start > INSTALL_LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for project skill install lock ${lockDir}`)
      }
      await delay(INSTALL_LOCK_RETRY_MS)
    }
  }

  try {
    return await callback()
  } finally {
    await rm(lockDir, { recursive: true, force: true })
  }
}

export const installProjectSkill = async (params: {
  config?: SkillsCliConfig
  force?: boolean
  registry?: string
  skill: NormalizedProjectSkillInstall | string | ConfiguredSkillInstallConfig
  workspaceFolder: string
}) => {
  const normalized = typeof params.skill === 'string'
    ? normalizeProjectSkillInstall(params.skill)
    : ('targetDirName' in params.skill
      ? params.skill
      : normalizeProjectSkillInstall(params.skill))

  if (normalized == null) {
    throw new Error('Skill reference is required.')
  }

  const installDir = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'skills',
    normalized.targetDirName
  )
  const skillPath = join(installDir, 'SKILL.md')
  const tempInstallDir = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'caches',
    'project-skill-installs',
    `${normalized.targetDirName}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  const lockDir = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'caches',
    'project-skill-installs',
    'locks',
    normalized.targetDirName
  )

  return await withInstallLock(lockDir, async () => {
    if (params.force !== true && await pathExists(skillPath)) {
      return buildInstalledSkillResult({
        installDir,
        normalized
      })
    }

    const installResult = normalized.source != null
      ? await installSkillsCliSkillToTemp({
        config: params.config,
        registry: params.registry,
        skill: normalized.name,
        source: normalized.source
      })
      : await (async () => {
        const searchResults = await findSkillsCli({
          config: params.config,
          registry: params.registry,
          query: normalized.name
        })
        const selected = pickSearchResult(searchResults, normalized.name)
        if (selected == null) {
          throw new Error(`Skill ${normalized.name} was not found by the skills CLI search.`)
        }

        return await installSkillsCliRefToTemp({
          config: params.config,
          registry: params.registry,
          installRef: selected.installRef
        })
      })()

    try {
      await rm(tempInstallDir, { recursive: true, force: true })
      await mkdir(dirname(tempInstallDir), { recursive: true })
      await mkdir(tempInstallDir, { recursive: true })
      await copyRegularFiles(installResult.installedSkill.sourcePath, tempInstallDir)

      const tempSkillPath = join(tempInstallDir, 'SKILL.md')
      if (!await pathExists(tempSkillPath)) {
        throw new Error(`Configured skill ${normalized.ref} did not include SKILL.md`)
      }
      await rewriteInstalledSkillName(tempSkillPath, normalized.targetName)

      await rm(installDir, { recursive: true, force: true })
      await mkdir(dirname(installDir), { recursive: true })
      await rename(tempInstallDir, installDir)

      return buildInstalledSkillResult({
        installDir,
        normalized
      })
    } catch (error) {
      await rm(tempInstallDir, { recursive: true, force: true })
      throw error
    } finally {
      await rm(installResult.tempDir, { recursive: true, force: true })
    }
  })
}

export const removeProjectSkill = async (params: {
  dirName: string
  workspaceFolder: string
}) => {
  const installDir = resolveProjectAiPath(params.workspaceFolder, process.env, 'skills', params.dirName)
  await rm(installDir, { recursive: true, force: true })
  return {
    dirName: params.dirName,
    installDir
  }
}
