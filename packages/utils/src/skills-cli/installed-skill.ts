import { readFile, readdir } from 'node:fs/promises'
import path, { join } from 'node:path'

import { parseFrontmatterValue, toSkillSlug } from './shared'

const readInstalledSkillMetadata = async (skillDir: string) => {
  try {
    const body = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
    return {
      name: parseFrontmatterValue(body, 'name') ?? path.basename(skillDir),
      ...(parseFrontmatterValue(body, 'description') != null
        ? { description: parseFrontmatterValue(body, 'description') }
        : {})
    }
  } catch {
    return {
      name: path.basename(skillDir)
    }
  }
}

export const selectInstalledSkillDir = async (params: {
  installedSkillsDir: string
  requestedSkill: string
}) => {
  const entries = await readdir(params.installedSkillsDir, { withFileTypes: true })
  const skillDirs = entries.filter(entry => entry.isDirectory())
  if (skillDirs.length === 0) {
    throw new Error(`skills CLI did not install any skills for "${params.requestedSkill}".`)
  }

  const installedSkills = await Promise.all(skillDirs.map(async (entry) => {
    const sourcePath = join(params.installedSkillsDir, entry.name)
    const metadata = await readInstalledSkillMetadata(sourcePath)
    return {
      dirName: entry.name,
      sourcePath,
      ...metadata
    }
  }))
  const requestedSlug = toSkillSlug(params.requestedSkill)
  const matched = installedSkills.find(skill => (
    skill.dirName === params.requestedSkill ||
    skill.name === params.requestedSkill ||
    toSkillSlug(skill.dirName) === requestedSlug ||
    toSkillSlug(skill.name) === requestedSlug
  ))

  if (matched != null) return matched
  if (installedSkills.length === 1) return installedSkills[0]

  throw new Error(
    `skills CLI installed multiple skills for "${params.requestedSkill}": ${
      installedSkills.map(skill => skill.name).join(', ')
    }`
  )
}
