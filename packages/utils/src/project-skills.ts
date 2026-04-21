import { access, copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

import type { ConfiguredSkillInstallConfig, SkillsCliConfig } from '@vibe-forge/types'

import { resolveProjectAiPath } from './ai-path'
import {
  findSkillsCli,
  installSkillsCliRefToTemp,
  installSkillsCliSkillToTemp,
  toSkillSlug
} from './skills-cli'

export interface ProjectSkillSummary {
  description?: string
  dirName: string
  name: string
}

export interface NormalizedProjectSkillInstall {
  ref: string
  name: string
  rename?: string
  source?: string
  targetName: string
  targetDirName: string
}

export interface ResolvedProjectSkillPublishSpec {
  kind: 'path' | 'project' | 'remote'
  requested: string
  skillSpec: string
  dirName?: string
  name?: string
}

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const stripWrappingQuotes = (value: string) => value.replace(/^["']|["']$/g, '')

const parseSkillFrontmatterValue = (body: string, key: 'description' | 'name') => {
  const lines = body.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined

  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    if (line.slice(0, separatorIndex).trim() !== key) continue
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())
    return value === '' ? undefined : value
  }

  return undefined
}

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

    await mkdir(dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

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

const parseStringInstall = (value: string): Omit<NormalizedProjectSkillInstall, 'targetDirName' | 'targetName'> => {
  const ref = value.trim()
  const atIndex = ref.lastIndexOf('@')
  if (atIndex > 0 && atIndex < ref.length - 1) {
    return {
      ref,
      source: ref.slice(0, atIndex),
      name: ref.slice(atIndex + 1)
    }
  }

  const sourcePathSegments = ref.split('/').filter(segment => segment.trim() !== '')
  if (
    sourcePathSegments.length >= 3 &&
    sourcePathSegments.every(segment => !segment.includes(' '))
  ) {
    return {
      ref,
      source: sourcePathSegments.slice(0, -1).join('/'),
      name: sourcePathSegments[sourcePathSegments.length - 1]
    }
  }

  return {
    ref,
    name: ref
  }
}

export const normalizeProjectSkillInstall = (
  value: string | ConfiguredSkillInstallConfig
): NormalizedProjectSkillInstall | undefined => {
  if (typeof value === 'string') {
    const parsed = parseStringInstall(value)
    const targetName = parsed.name.trim()
    const targetDirName = toSkillSlug(targetName)
    if (targetDirName === '') return undefined
    return {
      ...parsed,
      targetName,
      targetDirName
    }
  }

  const name = normalizeNonEmptyString(value.name)
  if (name == null) return undefined
  const source = normalizeNonEmptyString(value.source)
  const rename = normalizeNonEmptyString(value.rename)
  const targetName = rename ?? name
  const targetDirName = toSkillSlug(targetName)
  if (targetDirName === '') return undefined

  return {
    ref: source == null ? name : `${source}@${name}`,
    name,
    ...(source == null ? {} : { source }),
    ...(rename == null ? {} : { rename }),
    targetName,
    targetDirName
  }
}

const pickSearchResult = (results: Awaited<ReturnType<typeof findSkillsCli>>, name: string) => {
  const slug = toSkillSlug(name)
  return results.find(result => (
    result.skill === name ||
    toSkillSlug(result.skill) === slug
  )) ?? results[0]
}

const rewriteInstalledSkillName = async (skillPath: string, targetName: string) => {
  const content = await readFile(skillPath, 'utf8')
  const normalizedName = /^[A-Za-z0-9._/-]+$/.test(targetName)
    ? targetName
    : JSON.stringify(targetName)
  const lines = content.split(/\r?\n/)

  if (lines[0]?.trim() !== '---') {
    const nextContent = `---\nname: ${normalizedName}\n---\n\n${content.replace(/^\s+/, '')}`
    await writeFile(skillPath, nextContent, 'utf8')
    return
  }

  let closingIndex = -1
  let nameIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === '---') {
      closingIndex = index
      break
    }
    if (/^\s*name\s*:/.test(lines[index] ?? '')) {
      nameIndex = index
    }
  }

  if (closingIndex < 0) {
    const nextContent = `---\nname: ${normalizedName}\n---\n\n${content.replace(/^\s+/, '')}`
    await writeFile(skillPath, nextContent, 'utf8')
    return
  }

  if (nameIndex >= 0) {
    lines[nameIndex] = `name: ${normalizedName}`
  } else {
    lines.splice(closingIndex, 0, `name: ${normalizedName}`)
  }

  await writeFile(skillPath, `${lines.join('\n').replace(/\s+$/, '')}\n`, 'utf8')
}

export const readProjectSkills = async (workspaceFolder: string): Promise<ProjectSkillSummary[]> => {
  const skillsDir = resolveProjectAiPath(workspaceFolder, process.env, 'skills')

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    const skills = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const fallbackName = entry.name
          try {
            const body = await readFile(join(skillsDir, entry.name, 'SKILL.md'), 'utf8')
            return {
              dirName: entry.name,
              name: parseSkillFrontmatterValue(body, 'name') ?? fallbackName,
              ...(parseSkillFrontmatterValue(body, 'description') != null
                ? { description: parseSkillFrontmatterValue(body, 'description') }
                : {})
            }
          } catch {
            return {
              dirName: entry.name,
              name: fallbackName
            }
          }
        })
    )

    return skills
  } catch {
    return []
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

  const projectSkillsDir = resolveProjectAiPath(params.workspaceFolder, process.env, 'skills')
  const installDir = join(projectSkillsDir, normalized.targetDirName)
  const skillPath = join(installDir, 'SKILL.md')

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
    if (params.force === true) {
      await rm(installDir, { recursive: true, force: true })
    } else if (await pathExists(skillPath)) {
      throw new Error(`Skill "${normalized.targetName}" is already installed. Use --force to replace it.`)
    }

    await copyRegularFiles(installResult.installedSkill.sourcePath, installDir)
    if (!await pathExists(skillPath)) {
      throw new Error(`Configured skill ${normalized.ref} did not include SKILL.md`)
    }
    await rewriteInstalledSkillName(skillPath, normalized.targetName)
  } finally {
    await rm(installResult.tempDir, { recursive: true, force: true })
  }

  return {
    dirName: normalized.targetDirName,
    installDir,
    name: normalized.targetName,
    ref: normalized.ref,
    skillPath
  }
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
