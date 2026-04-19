import { mkdir, readdir, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import process from 'node:process'

import { DefinitionLoader } from '@vibe-forge/definition-loader'
import type { AdapterCtx, AdapterQueryOptions, Definition, Skill } from '@vibe-forge/types'
import { resolveProjectAiPath, syncSymlinkTarget } from '@vibe-forge/utils'

const toSkillSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
)

const resolveSkillName = (skill: Definition<Skill>) => skill.resolvedName ?? basename(dirname(skill.path))

const resolveDependencyNames = (skill: Definition<Skill>) => {
  const dependencies = skill.attributes.dependencies
  if (!Array.isArray(dependencies)) return []

  return dependencies.flatMap((dependency) => {
    if (typeof dependency === 'string') {
      const trimmed = dependency.trim()
      if (trimmed === '') return []
      const atIndex = trimmed.lastIndexOf('@')
      if (atIndex > 0 && atIndex < trimmed.length - 1) return [trimmed.slice(atIndex + 1)]
      const pathMatch = trimmed.match(/^([^/\s]+\/[^/\s]+)\/([^/\s]+)$/)
      return [pathMatch?.[2] ?? trimmed]
    }
    if (dependency == null || typeof dependency !== 'object' || Array.isArray(dependency)) return []
    return typeof dependency.name === 'string' && dependency.name.trim() !== '' ? [dependency.name.trim()] : []
  })
}

const expandSelectedSkills = (
  allSkills: Definition<Skill>[],
  selectedSkills: Definition<Skill>[],
  excludedNames: Set<string>
) => {
  const byName = new Map<string, Definition<Skill>>()
  for (const skill of allSkills) {
    const name = resolveSkillName(skill)
    byName.set(name, skill)
    byName.set(toSkillSlug(name), skill)
  }

  const result: Definition<Skill>[] = []
  const seen = new Set<string>()
  const addSkill = (skill: Definition<Skill>) => {
    const name = resolveSkillName(skill)
    if (excludedNames.has(name) || excludedNames.has(toSkillSlug(name))) return
    if (seen.has(name)) return
    seen.add(name)
    result.push(skill)

    for (const dependencyName of resolveDependencyNames(skill)) {
      const dependency = byName.get(dependencyName) ?? byName.get(toSkillSlug(dependencyName))
      if (dependency == null) {
        throw new Error(`Failed to resolve skill dependency ${dependencyName} declared by ${name}`)
      }
      addSkill(dependency)
    }
  }

  selectedSkills.forEach(addSkill)
  return result
}

const filterResolvedSkills = async (
  cwd: string,
  selection: AdapterQueryOptions['skills']
) => {
  const loader = new DefinitionLoader(cwd)
  const allSkills = await loader.loadDefaultSkills()
  const include = selection?.include != null && selection.include.length > 0
    ? new Set(selection.include)
    : undefined
  const exclude = new Set(selection?.exclude ?? [])
  const excludedNames = new Set(Array.from(exclude).flatMap(name => [name, toSkillSlug(name)]))
  const result = new Map<string, string>()

  const selectedSkills = allSkills.filter((skill) => {
    const name = resolveSkillName(skill)
    return !((include != null && !include.has(name)) || excludedNames.has(name) || excludedNames.has(toSkillSlug(name)))
  })

  for (const skill of expandSelectedSkills(allSkills, selectedSkills, excludedNames)) {
    const name = resolveSkillName(skill)
    if (excludedNames.has(name) || excludedNames.has(toSkillSlug(name)) || result.has(name)) continue
    result.set(name, dirname(skill.path))
  }

  return result
}

const ensureSymlinkTarget = async (sourcePath: string, targetPath: string) => {
  await syncSymlinkTarget({
    sourcePath,
    targetPath
  })
}

const mirrorDirectoryEntries = async (sourceDir: string, targetDir: string) => {
  try {
    const entries = await readdir(sourceDir, { withFileTypes: true })
    await mkdir(targetDir, { recursive: true })
    for (const entry of entries) {
      await ensureSymlinkTarget(resolve(sourceDir, entry.name), resolve(targetDir, entry.name))
    }
  } catch {
  }
}

export const ensureOpenCodeConfigDir = async (params: {
  ctx: AdapterCtx
  options: AdapterQueryOptions
}) => {
  const baseConfigDir = params.ctx.env.OPENCODE_CONFIG_DIR ?? process.env.OPENCODE_CONFIG_DIR ?? undefined
  const planOverlays = params.options.assetPlan?.overlays ?? []
  const resolvedSkills = planOverlays.length > 0
    ? new Map(
      planOverlays
        .filter((entry) => entry.kind === 'skill')
        .map((entry) => [basename(entry.targetPath), entry.sourcePath] as const)
    )
    : await filterResolvedSkills(params.ctx.cwd, params.options.skills)
  if (baseConfigDir == null && resolvedSkills.size === 0 && planOverlays.length === 0) return undefined

  const configDir = resolve(
    resolveProjectAiPath(params.ctx.cwd, params.ctx.env, '.mock', '.opencode-adapter'),
    params.options.sessionId,
    'config-dir'
  )
  await rm(configDir, { recursive: true, force: true })
  await mkdir(configDir, { recursive: true })

  if (baseConfigDir) {
    for (const folderName of ['agents', 'commands', 'modes', 'plugins']) {
      await ensureSymlinkTarget(resolve(baseConfigDir, folderName), resolve(configDir, folderName)).catch(() =>
        undefined
      )
    }
    for (const fileName of ['opencode.json', 'package.json', 'bun.lock', 'bun.lockb']) {
      await ensureSymlinkTarget(resolve(baseConfigDir, fileName), resolve(configDir, fileName)).catch(() => undefined)
    }
    await mirrorDirectoryEntries(resolve(baseConfigDir, 'skills'), resolve(configDir, 'skills'))
  }

  for (const [name, sourceDir] of resolvedSkills.entries()) {
    await ensureSymlinkTarget(sourceDir, resolve(configDir, 'skills', name))
  }

  for (const overlay of planOverlays.filter((entry) => entry.kind !== 'skill')) {
    await ensureSymlinkTarget(overlay.sourcePath, resolve(configDir, overlay.targetPath))
  }

  return configDir
}
