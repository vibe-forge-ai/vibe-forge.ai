import type {
  Definition,
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

type DocumentAssetKind = Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>
type DocumentAsset<TDefinition> = Extract<WorkspaceAsset, { kind: DocumentAssetKind }> & {
  payload: {
    definition: TDefinition & { path: string }
  }
}

const ASSET_REFERENCE_PATH_SUFFIXES = ['.md', '.json', '.yaml', '.yml']

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
  return included.filter(asset => !excluded.has(asset.id))
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
