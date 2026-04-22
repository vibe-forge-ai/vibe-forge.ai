import { access, copyFile, lstat, mkdir, readdir, rm } from 'node:fs/promises'
import path, { join } from 'node:path'
import process from 'node:process'

import type { SkillsCliConfig } from '@vibe-forge/types'

import { resolveProjectAiPath } from '@vibe-forge/utils'
import {
  installSkillsCliSkillToTemp,
  listSkillsCliSource,
  parseSkillsCliListOutput,
  toSkillSlug
} from '@vibe-forge/utils/skills-cli'

import { readProjectSkillNames } from './project-skills'
import type { SkillsCliInstallResult, SkillsCliSearchResult } from './types'

const DEFAULT_SEARCH_LIMIT = 100
const MAX_SEARCH_LIMIT = 500

const normalizeSearchLimit = (limit: number | undefined) => {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT)
}

const normalizeNonEmptyString = (value: unknown) => (
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

const copyRegularFiles = async (sourceDir: string, targetDir: string) => {
  let fileCount = 0
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)
    const stat = await lstat(sourcePath)

    if (stat.isDirectory()) {
      fileCount += await copyRegularFiles(sourcePath, targetPath)
      continue
    }

    if (!stat.isFile()) continue

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

export { parseSkillsCliListOutput }

export const searchSkillsCliSource = async (params: {
  config?: SkillsCliConfig
  limit?: number
  query?: string
  registry?: string
  source: string
  workspaceFolder: string
}): Promise<SkillsCliSearchResult> => {
  const source = normalizeNonEmptyString(params.source)
  if (source == null) {
    throw new Error('skills CLI source is required.')
  }
  const query = params.query?.trim().toLowerCase() ?? ''
  const limit = normalizeSearchLimit(params.limit)

  try {
    const [listedSkills, installedNames] = await Promise.all([
      listSkillsCliSource({
        config: params.config,
        registry: params.registry,
        source
      }),
      readProjectSkillNames(params.workspaceFolder)
    ])
    const filteredSkills = listedSkills.filter((skill) => {
      if (query === '') return true
      const haystack = `${skill.name} ${skill.description ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })

    return {
      source,
      hasMore: filteredSkills.length > limit,
      total: listedSkills.length,
      items: filteredSkills.slice(0, limit).map(skill => ({
        id: `skills-cli:${source}:${skill.name}`,
        registry: 'skills-cli',
        name: skill.name,
        ...(skill.description != null ? { description: skill.description } : {}),
        skills: [],
        commands: [],
        agents: [],
        mcpServers: [],
        hasHooks: false,
        installed: installedNames.has(skill.name) || installedNames.has(toSkillSlug(skill.name)),
        installRef: skill.name,
        source
      }))
    }
  } catch (error) {
    return {
      source,
      hasMore: false,
      items: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export const installSkillsCliSkill = async (params: {
  config?: SkillsCliConfig
  force?: boolean
  registry?: string
  skill: string
  source: string
  workspaceFolder: string
}): Promise<SkillsCliInstallResult> => {
  const source = normalizeNonEmptyString(params.source)
  if (source == null) {
    throw new Error('skills CLI source is required.')
  }
  const projectSkillsDir = resolveProjectAiPath(params.workspaceFolder, process.env, 'skills')

  const { installedSkill, tempDir } = await installSkillsCliSkillToTemp({
    config: params.config,
    registry: params.registry,
    skill: params.skill,
    source
  })

  try {
    const installDir = join(projectSkillsDir, installedSkill.dirName)

    if (params.force === true) {
      await rm(installDir, { recursive: true, force: true })
    } else if (await pathExists(installDir)) {
      throw new Error(`Skill "${installedSkill.name}" is already installed. Use force to replace it.`)
    }

    await copyRegularFiles(installedSkill.sourcePath, installDir)

    return {
      source,
      skill: params.skill,
      name: installedSkill.name,
      installedAt: new Date().toISOString(),
      installDir
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
