import { access, copyFile, lstat, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import type { Config, SkillsCliConfig } from '@vibe-forge/types'
import { resolveSkillsCliRuntimeConfig } from '@vibe-forge/utils'
import { resolveProjectSharedCachePath } from '@vibe-forge/utils/project-cache-path'
import {
  findSkillsCli,
  installSkillsCliRefToTemp,
  installSkillsCliSkillToTemp,
  resolveSkillsCliRegistry,
  toSkillSlug
} from '@vibe-forge/utils/skills-cli'

import type { NormalizedSkillDependency } from './skill-dependencies'

const INSTALL_LOCK_TIMEOUT_MS = 30_000
const INSTALL_LOCK_RETRY_MS = 100

const toCacheSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default'
)

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

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
        throw new Error(`Timed out waiting for skill dependency install lock ${lockDir}`)
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

const copyRegularFiles = async (sourceDir: string, targetDir: string) => {
  let fileCount = 0
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = resolve(sourceDir, entry.name)
    const targetPath = resolve(targetDir, entry.name)
    const stat = await lstat(sourcePath)

    if (stat.isDirectory()) {
      fileCount += await copyRegularFiles(sourcePath, targetPath)
      continue
    }

    if (!stat.isFile()) continue

    await mkdir(dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

const pickSearchResult = (results: Awaited<ReturnType<typeof findSkillsCli>>, name: string) => {
  const slug = toSkillSlug(name)
  return results.find(result => (
    result.skill === name ||
    toSkillSlug(result.skill) === slug
  )) ?? results[0]
}

const resolveConfiguredSkillsCliConfig = (configs: [Config?, Config?]) => {
  const [projectConfig, userConfig] = configs
  const merged = {
    ...(resolveSkillsCliRuntimeConfig(projectConfig) ?? {}),
    ...(resolveSkillsCliRuntimeConfig(userConfig) ?? {})
  } satisfies SkillsCliConfig

  return Object.keys(merged).length === 0 ? undefined : merged
}

const buildInstallDir = (params: {
  config?: SkillsCliConfig
  cwd: string
  skill: string
  source: string
}) => {
  const registry = resolveSkillsCliRegistry({
    config: params.config
  }) ?? 'default'
  return resolveProjectSharedCachePath(
    params.cwd,
    process.env,
    'skill-dependencies',
    'skills-cli',
    toCacheSegment(params.config?.package ?? 'skills'),
    toCacheSegment(params.config?.version ?? 'latest'),
    toCacheSegment(registry),
    ...params.source.split('/').map(toCacheSegment),
    toCacheSegment(params.skill)
  )
}

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
