import { basename, dirname } from 'node:path'

import type {
  RuleReference,
  SkillSelection,
  WorkspaceAsset,
  WorkspaceAssetAdapter,
  WorkspaceAssetBundle,
  WorkspaceAssetKind,
  WorkspaceSkillSelection
} from '@vibe-forge/types'
import { normalizePath, resolveDocumentName, resolveRelativePath, resolveSpecIdentifier } from '@vibe-forge/utils'
import { glob } from 'fast-glob'

import { assetOriginPriority, isPluginEnabled, resolvePluginIdFromPath, toAssetScope } from './helpers'
import type { WorkspaceDocumentAsset, WorkspaceDocumentPayload } from './internal-types'

const isLocalRuleReference = (
  rule: RuleReference
): rule is Extract<RuleReference, { path: string }> => (
  rule != null &&
  typeof rule === 'object' &&
  'path' in rule &&
  typeof rule.path === 'string'
)

export const createDocumentAsset = <
  TKind extends Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>,
  TDefinition,
>(
  params: {
    cwd: string
    kind: TKind
    definition: TDefinition & { path: string }
    targets?: WorkspaceAssetAdapter[]
  }
): Extract<WorkspaceAsset, { kind: TKind }> => {
  const pluginId = resolvePluginIdFromPath(params.cwd, params.definition.path)
  const origin: WorkspaceAsset['origin'] = pluginId == null ? 'project' : 'plugin'
  return {
    id: `${params.kind}:${resolveRelativePath(params.cwd, params.definition.path)}`,
    kind: params.kind,
    pluginId,
    origin,
    scope: toAssetScope(origin),
    enabled: true,
    targets: params.targets ?? ['claude-code', 'codex', 'opencode'],
    payload: {
      definition: params.definition as any,
      sourcePath: params.definition.path
    }
  } as Extract<WorkspaceAsset, { kind: TKind }>
}

export const dedupeDocumentAssets = <
  TAsset extends Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>,
>(
  assets: TAsset[],
  enabledPlugins: Record<string, boolean>
) => assets.filter((asset) => isPluginEnabled(enabledPlugins, asset.pluginId))

const compareDocumentAssetPriority = (
  left: Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>,
  right: Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>
) => {
  const originDiff = assetOriginPriority[left.origin] - assetOriginPriority[right.origin]
  if (originDiff !== 0) return originDiff
  return left.payload.definition.path.localeCompare(right.payload.definition.path)
}

export const dedupeDocumentAssetsByIdentifier = <
  TAsset extends Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>,
>(
  assets: TAsset[],
  resolveIdentifier: (asset: TAsset) => string
) => {
  const selected = new Map<string, TAsset>()

  for (const asset of [...assets].sort(compareDocumentAssetPriority)) {
    const identifier = resolveIdentifier(asset)
    if (!selected.has(identifier)) selected.set(identifier, asset)
  }

  return Array.from(selected.values()).sort(compareDocumentAssetPriority)
}

export const resolveRuleIdentifier = (
  path: string,
  explicitName?: string
) => resolveDocumentName(path, explicitName)

export const resolveSkillIdentifier = (
  path: string,
  explicitName?: string
) => resolveDocumentName(path, explicitName, ['skill.md'])

export const pickSpecAsset = (
  bundle: WorkspaceAssetBundle,
  name: string
): Extract<WorkspaceAsset, { kind: 'spec' }> | undefined => {
  const assets = bundle.specs.filter((asset) => {
    const definition = asset.payload.definition
    return resolveSpecIdentifier(definition.path, definition.attributes.name) === name
  })
  return assets.find(asset => asset.origin === 'project') ?? assets[0]
}

export const pickEntityAsset = (
  bundle: WorkspaceAssetBundle,
  name: string
): Extract<WorkspaceAsset, { kind: 'entity' }> | undefined => {
  const assets = bundle.entities.filter((asset) => {
    const definition = asset.payload.definition
    const identifier = resolveDocumentName(definition.path, definition.attributes.name, ['readme.md', 'index.json'])
    return identifier === name
  })
  return assets.find(asset => asset.origin === 'project') ?? assets[0]
}

export const filterSkillAssets = (
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>,
  selection?: WorkspaceSkillSelection
): Array<Extract<WorkspaceAsset, { kind: 'skill' }>> => {
  if (selection == null) return skills

  const include = selection.include != null && selection.include.length > 0
    ? new Set(selection.include)
    : undefined
  const exclude = new Set(selection.exclude ?? [])

  return skills.filter((skill) => {
    const name = basename(dirname(skill.payload.definition.path))
    return (include == null || include.has(name)) && !exclude.has(name)
  })
}

export const dedupeSkillAssets = (
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>
): Array<Extract<WorkspaceAsset, { kind: 'skill' }>> => {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    if (seen.has(skill.payload.definition.path)) return false
    seen.add(skill.payload.definition.path)
    return true
  })
}

export const resolveRulePatterns = (rules: RuleReference[]) => (
  rules.flatMap((rule) => {
    if (typeof rule === 'string') return [rule]
    if (isLocalRuleReference(rule)) return [rule.path]
    return []
  })
)

export const resolveIncludedSkillNames = (selection: string[] | SkillSelection) => (
  Array.isArray(selection)
    ? selection
    : selection.type === 'include'
    ? selection.list
    : []
)

export const resolveExcludedSkillNames = (selection: string[] | SkillSelection) => (
  Array.isArray(selection)
    ? []
    : selection.type === 'exclude'
    ? selection.list
    : []
)

export const resolveSelectedRuleAssets = async (
  bundle: WorkspaceAssetBundle,
  patterns: string[]
): Promise<Array<Extract<WorkspaceAsset, { kind: 'rule' }>>> => {
  const matchedPaths = new Set(
    (await glob(patterns, { cwd: bundle.cwd, absolute: true }))
      .map(normalizePath)
  )
  return bundle.rules.filter((asset) => matchedPaths.has(normalizePath(asset.payload.definition.path)))
}

export const toDocumentDefinitions = <TDefinition>(
  assets: Array<WorkspaceDocumentAsset<TDefinition>>
) => assets.map(asset => asset.payload.definition)

export const toPromptAssetIds = (assets: Array<{ id: string }>) => (
  Array.from(new Set(assets.map(asset => asset.id)))
)

export type { WorkspaceDocumentAsset, WorkspaceDocumentPayload }
