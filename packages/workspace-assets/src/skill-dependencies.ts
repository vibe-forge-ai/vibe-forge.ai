/* eslint-disable max-lines -- dependency normalization and graph expansion share the same local helpers */
import { readFile } from 'node:fs/promises'

import fm from 'front-matter'

import { parseScopedReference, resolveSkillIdentifier } from '@vibe-forge/definition-core'
import type { Config, Definition, Skill, WorkspaceAsset } from '@vibe-forge/types'
import { formatSkillsSpec, parseSkillsSpec, resolveRelativePath } from '@vibe-forge/utils'

import { HOME_BRIDGE_RESOLVED_BY } from './home-bridge'
import { installSkillsCliDependency } from './skills-cli-dependency'

type SkillAsset = Extract<WorkspaceAsset, { kind: 'skill' }>

export interface NormalizedSkillDependency {
  ref: string
  name: string
  registry?: string
  source?: string
  version?: string
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

const filterSearchableSkillAssets = (
  assets: SkillAsset[],
  options?: {
    includeHomeBridge?: boolean
  }
) => (
  options?.includeHomeBridge === false
    ? assets.filter(asset => asset.resolvedBy !== HOME_BRIDGE_RESOLVED_BY)
    : assets
)

const removeHomeBridgeSkillDuplicates = (
  assets: WorkspaceAsset[],
  displayName: string
) => {
  for (let index = assets.length - 1; index >= 0; index--) {
    const asset = assets[index]
    if (asset.kind !== 'skill') continue
    if (asset.resolvedBy !== HOME_BRIDGE_RESOLVED_BY) continue
    if (asset.displayName !== displayName) continue
    assets.splice(index, 1)
  }
}

const findSkillAssetByRef = (
  assets: SkillAsset[],
  ref: string,
  currentInstancePath?: string,
  options?: {
    includeHomeBridge?: boolean
  }
) => {
  const searchableAssets = filterSearchableSkillAssets(assets, options)
  const scoped = parseScopedReference(ref, { pathSuffixes: ['.md', '.json', '.yaml', '.yml'] })
  if (scoped != null) {
    return searchableAssets.find(asset => asset.scope === scoped.scope && asset.name === scoped.name)
  }

  if (currentInstancePath != null) {
    const local = searchableAssets.find(asset => asset.instancePath === currentInstancePath && asset.name === ref)
    if (local != null) return local
  }

  return resolveUniqueSkillByName(searchableAssets, ref)
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

const createResolvedSkillAsset = (params: {
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

export const normalizeSkillDependency = (value: unknown): NormalizedSkillDependency | undefined => {
  const stringValue = asNonEmptyString(value)
  if (stringValue != null) return parseSkillsSpec(stringValue)

  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const name = asNonEmptyString(record.name)
  if (name == null) return undefined

  const registry = asNonEmptyString(record.registry)
  const source = asNonEmptyString(record.source)
  const version = asNonEmptyString(record.version)
  return {
    ref: formatSkillsSpec({
      name,
      registry,
      source,
      version
    }),
    name,
    ...(registry == null ? {} : { registry }),
    ...(source == null ? {} : { source }),
    ...(version == null ? {} : { version })
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
  currentInstancePath?: string,
  options?: {
    includeHomeBridge?: boolean
  }
) => {
  const candidateRefs = Array.from(
    new Set([
      dependency.ref,
      dependency.name
    ])
  )

  for (const ref of candidateRefs) {
    const asset = findSkillAssetByRef(assets, ref, currentInstancePath, options)
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

export const expandSkillAssetDependenciesWithRemoteResolution = async (
  params: DependencyExpansionParams
) => {
  const selected: SkillAsset[] = []
  const seen = new Set<string>()
  const fetchedDependencyRefs = new Set<string>()

  const removeSupersededHomeBridgeSkill = (displayName: string) => {
    removeHomeBridgeSkillDuplicates(params.allAssets, displayName)
    removeHomeBridgeSkillDuplicates(params.skillAssets, displayName)
    removeHomeBridgeSkillDuplicates(params.selectedAssets, displayName)
    removeHomeBridgeSkillDuplicates(selected, displayName)
  }

  const installDependencyAsset = async (
    dependency: NormalizedSkillDependency,
    currentInstancePath?: string
  ) => {
    const fetchKey = dependency.ref
    if (!fetchedDependencyRefs.has(fetchKey)) {
      fetchedDependencyRefs.add(fetchKey)
      const installed = await installSkillsCliDependency({
        cwd: params.cwd,
        configs: params.configs,
        dependency
      })
      const definition = await parseFrontmatterSkill(installed.skillPath)
      const dependencyAsset = createResolvedSkillAsset({
        cwd: params.cwd,
        definition
      })
      const existingAsset = findSkillDependencyAsset(
        params.skillAssets,
        dependency,
        currentInstancePath,
        { includeHomeBridge: false }
      ) ??
        params.skillAssets.find(existing => (
          existing.resolvedBy !== HOME_BRIDGE_RESOLVED_BY &&
          existing.displayName === dependencyAsset.displayName
        ))
      if (existingAsset != null) {
        removeSupersededHomeBridgeSkill(existingAsset.displayName)
        return existingAsset
      }

      removeSupersededHomeBridgeSkill(dependencyAsset.displayName)
      params.allAssets.push(dependencyAsset)
      params.skillAssets.push(dependencyAsset)
      return dependencyAsset
    }

    // After the first fetch attempt, reuse whichever asset is now visible in the
    // skill set: a newly installed registry skill, or a home-bridge fallback
    // that was accepted by an earlier plain-name dependency resolution.
    const resolvedAsset = findSkillDependencyAsset(params.skillAssets, dependency, currentInstancePath)
    if (resolvedAsset != null && resolvedAsset.resolvedBy !== HOME_BRIDGE_RESOLVED_BY) {
      removeSupersededHomeBridgeSkill(resolvedAsset.displayName)
    }
    return resolvedAsset
  }

  const addAsset = async (asset: SkillAsset): Promise<void> => {
    if (params.excludedIds?.has(asset.id)) return
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    selected.push(asset)

    for (const dependency of normalizeSkillDependencies(asset.payload.definition.attributes.dependencies)) {
      const localOrBridgedDependency = findSkillDependencyAsset(
        params.skillAssets,
        dependency,
        asset.instancePath
      )
      const directDependency = findSkillDependencyAsset(
        params.skillAssets,
        dependency,
        asset.instancePath,
        { includeHomeBridge: false }
      )

      if (directDependency != null) {
        await addAsset(directDependency)
        continue
      }

      // Keep registry-backed dependencies ahead of home-bridge skills. We only
      // fall back to a bridged home skill for plain-name dependencies when the
      // registry path is unavailable.
      const dependencyAsset = await installDependencyAsset(dependency, asset.instancePath).catch((error: unknown) => {
        if (
          localOrBridgedDependency != null &&
          dependency.source == null
        ) {
          return localOrBridgedDependency
        }
        throw error
      }) ?? (
        dependency.source == null
          ? localOrBridgedDependency
          : undefined
      )

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
