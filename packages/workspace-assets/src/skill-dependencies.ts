import { readFile } from 'node:fs/promises'

import fm from 'front-matter'

import { parseScopedReference, resolveSkillIdentifier } from '@vibe-forge/definition-core'
import type { Config, Definition, Skill, WorkspaceAsset } from '@vibe-forge/types'
import { resolveRelativePath } from '@vibe-forge/utils'

import { installRegistrySkillDependency } from './skill-registry'

type SkillAsset = Extract<WorkspaceAsset, { kind: 'skill' }>

export interface NormalizedSkillDependency {
  ref: string
  name: string
  source?: string
  registry?: string
}

interface DependencyExpansionParams {
  allAssets: WorkspaceAsset[]
  configs: [Config?, Config?]
  cwd: string
  excludedIds?: Set<string>
  selectedAssets: SkillAsset[]
  skillAssets: SkillAsset[]
}

const asNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const toSkillSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
)

const resolveUniqueSkillByName = (assets: SkillAsset[], name: string) => {
  const nameSlug = toSkillSlug(name)
  const matches = assets.filter(asset => asset.name === name || toSkillSlug(asset.name) === nameSlug)
  if (matches.length === 0) return undefined

  const unscopedMatches = matches.filter(asset => asset.scope == null)
  if (unscopedMatches.length === 1) return unscopedMatches[0]

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous skill dependency ${name}. Candidates: ${matches.map(match => match.displayName).join(', ')}`
    )
  }

  return matches[0]
}

const findSkillAssetByRef = (
  assets: SkillAsset[],
  ref: string,
  currentInstancePath?: string
) => {
  const scoped = parseScopedReference(ref, { pathSuffixes: ['.md', '.json', '.yaml', '.yml'] })
  if (scoped != null) {
    return assets.find(asset => asset.scope === scoped.scope && asset.name === scoped.name)
  }

  if (currentInstancePath != null) {
    const local = assets.find(asset => asset.instancePath === currentInstancePath && asset.name === ref)
    if (local != null) return local
  }

  return resolveUniqueSkillByName(assets, ref)
}

const resolveDisplayName = (name: string, scope?: string) => (
  scope != null && scope.trim() !== '' ? `${scope}/${name}` : name
)

const parseFrontmatterSkill = async (path: string): Promise<Definition<Skill>> => {
  const content = await readFile(path, 'utf-8')
  const { body, attributes } = fm<Skill>(content)
  return {
    path,
    body,
    attributes
  }
}

const createRegistrySkillAsset = (params: {
  cwd: string
  definition: Definition<Skill>
}) => {
  const name = resolveSkillIdentifier(params.definition.path, params.definition.attributes.name)
  const displayName = resolveDisplayName(name)
  return {
    id: `skill:workspace:workspace:${displayName}:${resolveRelativePath(params.cwd, params.definition.path)}`,
    kind: 'skill',
    name,
    displayName,
    origin: 'workspace',
    sourcePath: params.definition.path,
    payload: {
      definition: params.definition
    }
  } satisfies SkillAsset
}

const parseStringDependency = (value: string): NormalizedSkillDependency => {
  const ref = value.trim()
  const atIndex = ref.lastIndexOf('@')
  if (atIndex > 0 && atIndex < ref.length - 1) {
    return {
      ref,
      source: ref.slice(0, atIndex),
      name: ref.slice(atIndex + 1)
    }
  }

  const sourcePathMatch = ref.match(/^([^/\s]+\/[^/\s]+)\/([^/\s]+)$/)
  if (sourcePathMatch != null) {
    return {
      ref,
      source: sourcePathMatch[1],
      name: sourcePathMatch[2]
    }
  }

  return {
    ref,
    name: ref
  }
}

export const normalizeSkillDependency = (value: unknown): NormalizedSkillDependency | undefined => {
  const stringValue = asNonEmptyString(value)
  if (stringValue != null) return parseStringDependency(stringValue)

  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const name = asNonEmptyString(record.name)
  if (name == null) return undefined

  const source = asNonEmptyString(record.source)
  return {
    ref: source == null ? name : `${source}@${name}`,
    name,
    ...(source == null ? {} : { source }),
    ...(asNonEmptyString(record.registry) == null ? {} : { registry: asNonEmptyString(record.registry) })
  }
}

export const normalizeSkillDependencies = (value: Skill['dependencies'] | undefined) => (
  Array.isArray(value)
    ? value
      .map(normalizeSkillDependency)
      .filter((dependency): dependency is NormalizedSkillDependency => dependency != null)
    : []
)

export const findSkillDependencyAsset = (
  assets: SkillAsset[],
  dependency: NormalizedSkillDependency,
  currentInstancePath?: string
) => {
  const candidateRefs = Array.from(
    new Set([
      dependency.ref,
      dependency.name
    ])
  )

  for (const ref of candidateRefs) {
    const asset = findSkillAssetByRef(assets, ref, currentInstancePath)
    if (asset != null) return asset
  }

  return undefined
}

export const expandSkillAssetDependencies = (
  assets: SkillAsset[],
  selectedAssets: SkillAsset[],
  options: {
    excludedIds?: Set<string>
  } = {}
) => {
  const selected: SkillAsset[] = []
  const seen = new Set<string>()

  const addAsset = (asset: SkillAsset) => {
    if (options.excludedIds?.has(asset.id)) return
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    selected.push(asset)

    for (const dependency of normalizeSkillDependencies(asset.payload.definition.attributes.dependencies)) {
      const dependencyAsset = findSkillDependencyAsset(assets, dependency, asset.instancePath)
      if (dependencyAsset == null) {
        throw new Error(`Failed to resolve skill dependency ${dependency.ref} declared by ${asset.displayName}`)
      }
      addAsset(dependencyAsset)
    }
  }

  selectedAssets.forEach(addAsset)
  return selected
}

export const expandSkillAssetDependenciesWithRegistry = async (
  params: DependencyExpansionParams
) => {
  const selected: SkillAsset[] = []
  const seen = new Set<string>()
  const fetchedDependencyRefs = new Set<string>()

  const installDependencyAsset = async (
    dependency: NormalizedSkillDependency,
    currentInstancePath?: string
  ) => {
    const fetchKey = `${dependency.registry ?? ''}:${dependency.ref}`
    if (!fetchedDependencyRefs.has(fetchKey)) {
      fetchedDependencyRefs.add(fetchKey)
      const installed = await installRegistrySkillDependency({
        cwd: params.cwd,
        configs: params.configs,
        dependency
      })
      const definition = await parseFrontmatterSkill(installed.skillPath)
      const dependencyAsset = createRegistrySkillAsset({
        cwd: params.cwd,
        definition
      })
      const existingAsset = findSkillDependencyAsset(params.skillAssets, dependency, currentInstancePath) ??
        params.skillAssets.find(existing => existing.displayName === dependencyAsset.displayName)
      if (existingAsset != null) return existingAsset

      params.allAssets.push(dependencyAsset)
      params.skillAssets.push(dependencyAsset)
      return dependencyAsset
    }

    return findSkillDependencyAsset(params.skillAssets, dependency, currentInstancePath)
  }

  const addAsset = async (asset: SkillAsset): Promise<void> => {
    if (params.excludedIds?.has(asset.id)) return
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    selected.push(asset)

    for (const dependency of normalizeSkillDependencies(asset.payload.definition.attributes.dependencies)) {
      const dependencyAsset = findSkillDependencyAsset(params.skillAssets, dependency, asset.instancePath) ??
        await installDependencyAsset(dependency, asset.instancePath)
      if (dependencyAsset == null) {
        throw new Error(`Failed to resolve skill dependency ${dependency.ref} declared by ${asset.displayName}`)
      }
      await addAsset(dependencyAsset)
    }
  }

  for (const asset of params.selectedAssets) {
    await addAsset(asset)
  }

  return selected
}
