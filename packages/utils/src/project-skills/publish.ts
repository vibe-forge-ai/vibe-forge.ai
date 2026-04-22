import { lstat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

import { resolveProjectAiPath } from '../ai-path'
import { toSkillSlug } from '../skills-cli'
import { readProjectSkills } from './read'
import { normalizeNonEmptyString, pathExists } from './shared'
import type { ResolvedProjectSkillPublishSpec } from './types'

const isRemotePublishSpec = (value: string) => (
  /^(?:https?|ssh):\/\//.test(value) ||
  /^[^@\s]+@[^:\s]+:.+/.test(value)
)

const isPathLikePublishSpec = (value: string) => (
  value.startsWith('.') ||
  value.startsWith('~') ||
  value.startsWith('/') ||
  value.includes('\\') ||
  value.includes('/')
)

const ensurePublishableSkillPath = async (targetPath: string) => {
  const stat = await lstat(targetPath)

  if (stat.isFile()) {
    if (basename(targetPath).toLowerCase() !== 'skill.md') {
      return targetPath
    }
    return dirname(targetPath)
  }

  if (!stat.isDirectory()) {
    throw new Error(`Local skill path "${targetPath}" is not a file or directory.`)
  }

  if (!await pathExists(join(targetPath, 'SKILL.md'))) {
    throw new Error(`Local skill path "${targetPath}" does not contain SKILL.md.`)
  }

  return targetPath
}

export const resolveProjectSkillPublishSpec = async (params: {
  selector: string
  workspaceFolder: string
}): Promise<ResolvedProjectSkillPublishSpec> => {
  const selector = normalizeNonEmptyString(params.selector)
  if (selector == null) {
    throw new Error('Skill selector is required.')
  }

  if (isRemotePublishSpec(selector)) {
    return {
      kind: 'remote',
      requested: selector,
      skillSpec: selector
    }
  }

  const explicitPath = isAbsolute(selector)
    ? selector
    : resolve(params.workspaceFolder, selector)
  if (await pathExists(explicitPath)) {
    return {
      kind: 'path',
      requested: selector,
      skillSpec: await ensurePublishableSkillPath(explicitPath)
    }
  }

  const selectorSlug = toSkillSlug(selector)
  const projectSkills = await readProjectSkills(params.workspaceFolder)
  const matches = projectSkills.filter(skill => (
    skill.dirName === selector ||
    skill.name === selector ||
    skill.dirName === selectorSlug ||
    toSkillSlug(skill.name) === selectorSlug
  ))

  if (matches.length > 1) {
    throw new Error(
      `Multiple local skills matched "${selector}": ${matches.map(skill => skill.name).join(', ')}`
    )
  }

  const matched = matches[0]
  if (matched != null) {
    const installDir = resolveProjectAiPath(params.workspaceFolder, process.env, 'skills', matched.dirName)
    return {
      kind: 'project',
      requested: selector,
      skillSpec: await ensurePublishableSkillPath(installDir),
      dirName: matched.dirName,
      name: matched.name
    }
  }

  if (isPathLikePublishSpec(selector)) {
    throw new Error(`Local skill path "${explicitPath}" does not exist.`)
  }

  throw new Error(`No local skill matched "${selector}". Pass a project skill name, local path, or remote git/zip URL.`)
}
