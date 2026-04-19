import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveProjectAiPath } from '@vibe-forge/utils'

import type { SkillHubInstallResult } from './types'
import {
  SKILLS_API_BASE,
  VERCEL_SKILLS_REGISTRY_ID,
  assertSafeSkillFilePath,
  fetchSkillsJson
} from './vercel-skills-common'
import type { SkillsDownloadResponse } from './vercel-skills-common'

const parseInstallRef = (value: string) => {
  const separatorIndex = value.lastIndexOf('@')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`Invalid skills.sh install reference "${value}".`)
  }
  const source = value.slice(0, separatorIndex)
  const skill = value.slice(separatorIndex + 1)
  const [owner, repo, ...extra] = source.split('/')
  if (!owner || !repo || extra.length > 0) {
    throw new Error(`Invalid skills.sh source "${source}".`)
  }
  return { owner, repo, skill }
}

const sanitizeSkillDirName = (value: string) => (
  value.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'skill'
)

const pathExists = async (target: string) => {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

export const installVercelSkill = async (params: {
  workspaceFolder: string
  plugin: string
  force?: boolean
}): Promise<SkillHubInstallResult> => {
  const target = parseInstallRef(params.plugin)
  const downloadUrl = new URL(
    `/api/download/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/${
      encodeURIComponent(target.skill)
    }`,
    SKILLS_API_BASE
  )
  const download = await fetchSkillsJson<SkillsDownloadResponse>(downloadUrl.toString())
  const files = download.files.map(file => ({ ...file, path: assertSafeSkillFilePath(file.path) }))
  if (!files.some(file => file.path === 'SKILL.md')) {
    throw new Error(`Downloaded skill "${target.skill}" is missing SKILL.md.`)
  }

  const installDir = resolveProjectAiPath(
    params.workspaceFolder,
    process.env,
    'skills',
    sanitizeSkillDirName(target.skill)
  )
  if (params.force === true) {
    await rm(installDir, { recursive: true, force: true })
  } else if (await pathExists(installDir)) {
    throw new Error(`Skill "${target.skill}" is already installed. Use force to replace it.`)
  }

  for (const file of files) {
    const targetPath = path.join(installDir, file.path)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, file.contents, 'utf8')
  }

  return {
    registry: VERCEL_SKILLS_REGISTRY_ID,
    plugin: params.plugin,
    name: target.skill,
    installedAt: new Date().toISOString(),
    installDir
  }
}
