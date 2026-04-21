import type {
  Definition,
  Entity,
  EntityInheritance,
  EntityInheritanceMode,
  Filter,
  PluginConfig,
  PluginOverlayConfig,
  Rule,
  RuleReference,
  SkillSelection,
  WorkspaceAsset,
  WorkspaceAssetBundle,
  WorkspaceAssetKind,
  WorkspaceMcpSelection,
  WorkspaceSkillSelection
} from '@vibe-forge/types'
import { normalizePath } from '@vibe-forge/utils'
import { mergePluginConfigs, normalizePluginConfig } from '@vibe-forge/utils/plugin-resolver'
import { glob } from 'fast-glob'

import {
  createRemoteRuleDefinition,
  isLocalRuleReference,
  isPathLikeReference,
  isRemoteRuleReference,
  parseScopedReference
} from '@vibe-forge/definition-core'
import { expandSkillAssetDependencies, expandSkillAssetDependenciesWithRegistry } from './skill-dependencies'

type DocumentAssetKind = Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>
type DocumentAsset<TDefinition> = Extract<WorkspaceAsset, { kind: DocumentAssetKind }> & {
  payload: {
    definition: TDefinition & { path: string }
  }
}
type EntityAsset = Extract<WorkspaceAsset, { kind: 'entity' }>
type EntityInheritanceField = Exclude<keyof EntityInheritance, 'default'>

const ASSET_REFERENCE_PATH_SUFFIXES = ['.md', '.json', '.yaml', '.yml']
const ENTITY_INHERITANCE_FIELDS = ['prompt', 'tags', 'rules', 'skills', 'tools', 'mcpServers'] as const
const ENTITY_INHERITANCE_MODES = new Set<EntityInheritanceMode>(['append', 'prepend', 'merge', 'replace', 'none'])
const DEFAULT_CHILD_ENTITY_INHERITANCE: Record<EntityInheritanceField, EntityInheritanceMode> = {
  prompt: 'append',
  tags: 'merge',
  rules: 'merge',
  skills: 'merge',
  tools: 'replace',
  mcpServers: 'replace'
}
const PARENT_ENTITY_INHERITANCE: Record<EntityInheritanceField, EntityInheritanceMode> = {
  prompt: 'append',
  tags: 'merge',
  rules: 'merge',
  skills: 'merge',
  tools: 'replace',
  mcpServers: 'replace'
}

export const definitionWithResolvedName = <TDefinition>(
  definition: Definition<TDefinition>,
  resolvedName: string,
  instancePath?: string
) => ({
  ...definition,
  resolvedName,
  resolvedInstancePath: instancePath
})

export const toDocumentDefinitions = <TDefinition>(
  assets: Array<DocumentAsset<TDefinition>>
) =>
  assets.map(asset =>
    definitionWithResolvedName(
      asset.payload.definition,
      asset.displayName,
      asset.instancePath
    )
  )

const resolveUniqueAssetByName = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  name: string
) => {
  const matches = assets.filter(asset => asset.name === name)
  if (matches.length === 0) return undefined
  const unscopedMatches = matches.filter(asset => asset.scope == null)
  if (unscopedMatches.length === 1) {
    return unscopedMatches[0]
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous asset reference ${name}. Candidates: ${matches.map(match => match.displayName).join(', ')}`
    )
  }
  return matches[0]
}

const resolveScopedAsset = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  scope: string,
  name: string
) => assets.find(asset => asset.scope === scope && asset.name === name)

export const findNamedAsset = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  ref: string,
  currentInstancePath?: string
) => {
  const scoped = parseScopedReference(ref, { pathSuffixes: ASSET_REFERENCE_PATH_SUFFIXES })
  if (scoped != null) {
    return resolveScopedAsset(assets, scoped.scope, scoped.name)
  }

  if (currentInstancePath != null) {
    const local = assets.find(asset => asset.instancePath === currentInstancePath && asset.name === ref)
    if (local != null) {
      return local
    }
  }

  return resolveUniqueAssetByName(assets, ref)
}

export const resolveNamedAssets = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  refs: string[] | undefined,
  currentInstancePath?: string
) => {
  if (refs == null || refs.length === 0) return [] as TAsset[]

  const selected: TAsset[] = []
  const seen = new Set<string>()

  const add = (asset: TAsset) => {
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    selected.push(asset)
  }

  for (const ref of refs) {
    const asset = findNamedAsset(assets, ref, currentInstancePath)
    if (asset == null) throw new Error(`Failed to resolve asset ${ref}`)
    add(asset)
  }

  return selected
}

const normalizeEntityExtends = (value: Entity['extends']) => {
  if (typeof value === 'string') return value.trim() !== '' ? [value.trim()] : []
  if (!Array.isArray(value)) return []

  return value
    .map(ref => ref.trim())
    .filter(Boolean)
}

const parseEntityInheritanceMode = (
  value: unknown,
  label: string
): EntityInheritanceMode | undefined => {
  if (value == null) return undefined
  if (typeof value !== 'string' || !ENTITY_INHERITANCE_MODES.has(value as EntityInheritanceMode)) {
    throw new Error(`Invalid entity inherit mode for ${label}: ${String(value)}`)
  }
  return value as EntityInheritanceMode
}

const resolveEntityInheritanceModes = (
  value: Entity['inherit'],
  defaults: Record<EntityInheritanceField, EntityInheritanceMode>
) => {
  const modes = { ...defaults }
  if (value == null) return modes

  if (typeof value === 'string') {
    const defaultMode = parseEntityInheritanceMode(value, 'inherit')
    for (const field of ENTITY_INHERITANCE_FIELDS) {
      modes[field] = defaultMode ?? modes[field]
    }
    return modes
  }

  const defaultMode = parseEntityInheritanceMode(value.default, 'inherit.default')
  for (const field of ENTITY_INHERITANCE_FIELDS) {
    modes[field] = parseEntityInheritanceMode(value[field], `inherit.${field}`) ?? defaultMode ?? modes[field]
  }
  return modes
}

const toUniqueStrings = (values: string[]) => Array.from(new Set(values))

const toUniqueValues = <TValue>(values: TValue[], keyOf: (value: TValue) => string) => {
  const seen = new Set<string>()
  const result: TValue[] = []

  for (const value of values) {
    const key = keyOf(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }

  return result
}

const keyRuleReference = (rule: RuleReference) => (
  typeof rule === 'string' ? `string:${rule}` : `object:${JSON.stringify(rule)}`
)

const qualifyEntityReference = (
  asset: EntityAsset,
  ref: string
) => {
  const value = ref.trim()
  if (value === '' || asset.scope == null) return value
  if (parseScopedReference(value, { pathSuffixes: ASSET_REFERENCE_PATH_SUFFIXES }) != null) return value
  if (
    isPathLikeReference(value, {
      pathSuffixes: ASSET_REFERENCE_PATH_SUFFIXES,
      allowGlob: true
    })
  ) {
    return value
  }

  return `${asset.scope}/${value}`
}

const qualifyEntityRuleReferences = (
  asset: EntityAsset,
  rules: Entity['rules']
) => rules?.map(rule => typeof rule === 'string' ? qualifyEntityReference(asset, rule) : rule)

const qualifyEntitySkillSelection = (
  asset: EntityAsset,
  selection: Entity['skills']
): Entity['skills'] => {
  if (selection == null) return undefined
  if (Array.isArray(selection)) return selection.map(ref => qualifyEntityReference(asset, ref))

  return {
    ...selection,
    list: selection.list.map(ref => qualifyEntityReference(asset, ref))
  }
}

const qualifyEntityInternalReferences = (
  asset: EntityAsset,
  definition: Definition<Entity>
): Definition<Entity> => ({
  ...definition,
  attributes: {
    ...definition.attributes,
    rules: qualifyEntityRuleReferences(asset, definition.attributes.rules),
    skills: qualifyEntitySkillSelection(asset, definition.attributes.skills)
  }
})

const selectInheritedValue = <TValue>(
  parent: TValue | undefined,
  child: TValue | undefined,
  mode: EntityInheritanceMode,
  merge: (left: TValue, right: TValue) => TValue
) => {
  if (mode === 'none') return child
  if (mode === 'replace') return child ?? parent
  if (parent == null) return child
  if (child == null) return parent
  return mode === 'prepend' ? merge(child, parent) : merge(parent, child)
}

const mergeEntityBody = (
  parent: string,
  child: string,
  mode: EntityInheritanceMode
) => {
  if (mode === 'none' || mode === 'replace') return child

  const values = mode === 'prepend' ? [child, parent] : [parent, child]
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .join('\n\n')
}

const getSkillIncludeRefs = (selection: Entity['skills']) => {
  if (Array.isArray(selection)) return selection
  return selection?.type === 'include' ? selection.list : undefined
}

const mergeSkillSelections = (
  parent: Entity['skills'],
  child: Entity['skills']
): Entity['skills'] => {
  const parentRefs = getSkillIncludeRefs(parent)
  const childRefs = getSkillIncludeRefs(child)
  if (parentRefs != null && childRefs != null) return toUniqueStrings([...parentRefs, ...childRefs])

  return child ?? parent
}

const mergeFilters = (
  parent: Filter,
  child: Filter
): Filter => {
  const include = toUniqueStrings([
    ...(parent.include ?? []),
    ...(child.include ?? [])
  ])
  const exclude = toUniqueStrings([
    ...(parent.exclude ?? []),
    ...(child.exclude ?? [])
  ])

  return {
    ...(include.length > 0 ? { include } : {}),
    ...(exclude.length > 0 ? { exclude } : {})
  }
}

const mergeEntityDefinitions = (
  parent: Definition<Entity>,
  child: Definition<Entity>,
  modes: Record<EntityInheritanceField, EntityInheritanceMode>
): Definition<Entity> => ({
  ...child,
  body: mergeEntityBody(parent.body, child.body, modes.prompt),
  attributes: {
    ...parent.attributes,
    ...child.attributes,
    name: child.attributes.name,
    description: child.attributes.description ?? parent.attributes.description,
    always: child.attributes.always ?? parent.attributes.always,
    tags: selectInheritedValue(
      parent.attributes.tags,
      child.attributes.tags,
      modes.tags,
      (left, right) => toUniqueStrings([...left, ...right])
    ),
    rules: selectInheritedValue(
      parent.attributes.rules,
      child.attributes.rules,
      modes.rules,
      (left, right) => toUniqueValues([...left, ...right], keyRuleReference)
    ),
    skills: selectInheritedValue(parent.attributes.skills, child.attributes.skills, modes.skills, mergeSkillSelections),
    tools: selectInheritedValue(parent.attributes.tools, child.attributes.tools, modes.tools, mergeFilters),
    mcpServers: selectInheritedValue(
      parent.attributes.mcpServers,
      child.attributes.mcpServers,
      modes.mcpServers,
      mergeFilters
    ),
    plugins: child.attributes.plugins
  }
})

const uniqueAssetIds = (values: string[]) => toUniqueValues(values, value => value)

const formatEntityCycle = (stack: EntityAsset[], asset: EntityAsset) => (
  [...stack.slice(stack.findIndex(item => item.id === asset.id)), asset]
    .map(item => item.displayName)
    .join(' -> ')
)

const createAvailableEntitiesMessage = (entities: EntityAsset[]) => (
  entities
    .map(asset => asset.displayName)
    .sort((left, right) => left.localeCompare(right))
    .join(', ')
)

export const resolveEntityInheritance = (
  bundle: WorkspaceAssetBundle,
  asset: EntityAsset
): {
  assetIds: string[]
  definition: Definition<Entity>
} => {
  const resolveAsset = (
    current: EntityAsset,
    stack: EntityAsset[]
  ): {
    assetIds: string[]
    definition: Definition<Entity>
  } => {
    if (stack.some(item => item.id === current.id)) {
      throw new Error(`Circular entity inheritance detected: ${formatEntityCycle(stack, current)}`)
    }

    const currentDefinition = definitionWithResolvedName(
      current.payload.definition,
      current.displayName,
      current.instancePath
    )
    const qualifiedCurrentDefinition = qualifyEntityInternalReferences(current, currentDefinition)
    const parentRefs = normalizeEntityExtends(qualifiedCurrentDefinition.attributes.extends)
    if (parentRefs.length === 0) {
      return {
        assetIds: [current.id],
        definition: qualifiedCurrentDefinition
      }
    }

    let inheritedBase: Definition<Entity> | undefined
    const inheritedAssetIds: string[] = []
    for (const ref of parentRefs) {
      const parentAsset = findNamedAsset(bundle.entities, ref, current.instancePath)
      if (parentAsset == null) {
        throw new Error(
          `Failed to resolve entity ${ref}. Available entities: ${createAvailableEntitiesMessage(bundle.entities)}`
        )
      }

      const parent = resolveAsset(parentAsset, [...stack, current])
      inheritedAssetIds.push(...parent.assetIds)
      inheritedBase = inheritedBase == null
        ? parent.definition
        : mergeEntityDefinitions(inheritedBase, parent.definition, PARENT_ENTITY_INHERITANCE)
    }

    return {
      assetIds: uniqueAssetIds([...inheritedAssetIds, current.id]),
      definition: mergeEntityDefinitions(
        inheritedBase ?? qualifiedCurrentDefinition,
        qualifiedCurrentDefinition,
        resolveEntityInheritanceModes(qualifiedCurrentDefinition.attributes.inherit, DEFAULT_CHILD_ENTITY_INHERITANCE)
      )
    }
  }

  return resolveAsset(asset, [])
}

const resolvePathMatchedRules = async (
  bundle: WorkspaceAssetBundle,
  ref: string
) => {
  const matchedPaths = new Set(
    (await glob(ref, {
      cwd: bundle.cwd,
      absolute: true
    })).map(normalizePath)
  )
  return bundle.rules.filter(rule => matchedPaths.has(normalizePath(rule.sourcePath)))
}

export const resolveRuleSelection = async (
  bundle: WorkspaceAssetBundle,
  refs: RuleReference[] | string[] | undefined,
  currentInstancePath?: string
): Promise<{
  assets: Array<Extract<WorkspaceAsset, { kind: 'rule' }>>
  remoteDefinitions: Definition<Rule>[]
}> => {
  const assets: Array<Extract<WorkspaceAsset, { kind: 'rule' }>> = []
  const remoteDefinitions: Definition<Rule>[] = []
  const seen = new Set<string>()

  const addAsset = (asset: Extract<WorkspaceAsset, { kind: 'rule' }>) => {
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    assets.push(asset)
  }

  let remoteIndex = 0
  for (const ref of refs ?? []) {
    if (isRemoteRuleReference(ref)) {
      remoteDefinitions.push(createRemoteRuleDefinition(ref, remoteIndex++))
      continue
    }

    const value = typeof ref === 'string'
      ? ref
      : isLocalRuleReference(ref)
      ? ref.path
      : undefined
    if (value == null) continue
    if (
      isPathLikeReference(value, {
        pathSuffixes: ASSET_REFERENCE_PATH_SUFFIXES,
        allowGlob: true
      })
    ) {
      const matched = await resolvePathMatchedRules(bundle, value)
      matched.forEach(addAsset)
      continue
    }

    const asset = findNamedAsset(bundle.rules, value, currentInstancePath)
    if (asset == null) throw new Error(`Failed to resolve rule ${value}`)
    addAsset(asset)
  }

  return {
    assets,
    remoteDefinitions
  }
}

export const resolveIncludedSkillRefs = (selection: string[] | SkillSelection | undefined) => {
  if (selection == null) return undefined
  if (Array.isArray(selection)) return selection
  return selection.type === 'include' ? selection.list : undefined
}

export const resolveExcludedSkillRefs = (selection: string[] | SkillSelection | undefined) => {
  if (selection == null || Array.isArray(selection)) return undefined
  return selection.type === 'exclude' ? selection.list : undefined
}

export const resolveSelectedSkillAssets = (
  assets: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>,
  selection?: WorkspaceSkillSelection
): Array<Extract<WorkspaceAsset, { kind: 'skill' }>> => {
  if (selection == null) return assets

  const included = selection.include != null && selection.include.length > 0
    ? resolveNamedAssets(assets, selection.include)
    : assets
  const excluded = new Set(
    resolveNamedAssets(assets, selection.exclude).map(asset => asset.id)
  )
  return expandSkillAssetDependencies(assets, included, {
    excludedIds: excluded
  })
}

export const resolveSelectedSkillAssetsWithDependencies = async (
  bundle: WorkspaceAssetBundle,
  selection?: WorkspaceSkillSelection
): Promise<Array<Extract<WorkspaceAsset, { kind: 'skill' }>>> => {
  const included = selection?.include != null && selection.include.length > 0
    ? resolveNamedAssets(bundle.skills, selection.include)
    : bundle.skills
  const excluded = new Set(
    resolveNamedAssets(bundle.skills, selection?.exclude).map(asset => asset.id)
  )
  return await expandSkillAssetDependenciesWithRegistry({
    allAssets: bundle.assets,
    configs: bundle.configs ?? [undefined, undefined],
    cwd: bundle.cwd,
    excludedIds: excluded,
    selectedAssets: included,
    skillAssets: bundle.skills
  })
}

export const resolveSelectedMcpNames = (
  bundle: WorkspaceAssetBundle,
  selection: WorkspaceMcpSelection | undefined
) => {
  const allAssets = Object.values(bundle.mcpServers)
  const includeRefs = selection?.include ??
    (bundle.defaultIncludeMcpServers.length > 0 ? bundle.defaultIncludeMcpServers : undefined)
  const excludeRefs = selection?.exclude ??
    (bundle.defaultExcludeMcpServers.length > 0 ? bundle.defaultExcludeMcpServers : undefined)

  const resolveRefs = (refs: string[] | undefined) => {
    if (refs == null || refs.length === 0) return undefined
    return new Set(refs.map((ref) => {
      const scoped = parseScopedReference(ref, { pathSuffixes: ASSET_REFERENCE_PATH_SUFFIXES })
      if (scoped != null) {
        const asset = allAssets.find(item => item.scope === scoped.scope && item.name === scoped.name)
        if (asset == null) throw new Error(`Failed to resolve MCP server ${ref}`)
        return asset.displayName
      }

      const matches = allAssets.filter(item => item.name === ref || item.displayName === ref)
      if (matches.length === 0) throw new Error(`Failed to resolve MCP server ${ref}`)
      if (matches.length > 1) {
        throw new Error(
          `Ambiguous MCP server reference ${ref}. Candidates: ${matches.map(match => match.displayName).join(', ')}`
        )
      }
      return matches[0].displayName
    }))
  }

  const include = resolveRefs(includeRefs)
  const exclude = resolveRefs(excludeRefs) ?? new Set<string>()

  return allAssets
    .map(asset => asset.displayName)
    .filter(name => (include == null || include.has(name)) && !exclude.has(name))
}

export const resolvePluginOverlay = (
  basePlugins: PluginConfig | undefined,
  overlay: PluginOverlayConfig | undefined
) => {
  if (overlay == null) return basePlugins
  if (overlay.mode !== 'override' && overlay.mode !== 'extend') {
    throw new Error('Invalid plugins overlay. "mode" must be "extend" or "override".')
  }

  const overlayList = normalizePluginConfig(overlay.list, 'plugins overlay list') ?? []
  return overlay.mode === 'override'
    ? overlayList
    : mergePluginConfigs(basePlugins, overlayList)
}

export const pickDocumentAsset = <TAsset extends Extract<WorkspaceAsset, { kind: 'spec' | 'entity' }>>(
  assets: TAsset[],
  ref: string
) => findNamedAsset(assets, ref)
