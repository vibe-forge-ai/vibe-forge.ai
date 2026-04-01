import process from 'node:process'

import type {
  AdapterAssetPlan,
  AssetDiagnostic,
  Definition,
  Entity,
  Filter,
  PromptAssetResolution,
  Rule,
  Skill,
  Spec,
  WorkspaceAsset,
  WorkspaceAssetBundle,
  WorkspaceAssetKind
} from '@vibe-forge/types'
import { resolveDocumentName, resolveSpecIdentifier } from '@vibe-forge/utils'

const sortStrings = (values: string[]) => [...values].sort((left, right) => left.localeCompare(right))

const sanitizeValue = (
  value: string,
  cwd: string
) => (
  value
    .replaceAll(`/private${cwd}`, '<workspace>')
    .replaceAll(cwd, '<workspace>')
    .replaceAll(`/private${process.execPath}`, '<node-path>')
    .replaceAll(process.execPath, '<node-path>')
)

const normalizeValue = (
  value: unknown,
  cwd: string
): unknown => {
  if (typeof value === 'string') {
    return sanitizeValue(value, cwd)
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeValue(item, cwd))
  }

  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeValue(entry, cwd)])
    )
  }

  return value
}

const sortFilter = (filter: Filter | undefined) => {
  if (filter == null) return undefined
  return {
    include: filter.include == null ? undefined : sortStrings(filter.include),
    exclude: filter.exclude == null ? undefined : sortStrings(filter.exclude)
  }
}

const resolveDefinitionIdentifier = (
  kind: Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>,
  definition: Definition<Rule | Spec | Entity | Skill>
) => {
  if (kind === 'spec') {
    return resolveSpecIdentifier(definition.path, definition.attributes.name)
  }

  if (kind === 'entity') {
    return resolveDocumentName(definition.path, definition.attributes.name, ['readme.md', 'index.json'])
  }

  if (kind === 'skill') {
    return resolveDocumentName(definition.path, definition.attributes.name, ['skill.md'])
  }

  return resolveDocumentName(definition.path, definition.attributes.name)
}

const summarizeDefinition = (
  kind: Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>,
  definition: Definition<Rule | Spec | Entity | Skill>,
  cwd: string
) => ({
  identifier: resolveDefinitionIdentifier(kind, definition),
  path: sanitizeValue(definition.path, cwd),
  attributes: normalizeValue(definition.attributes, cwd),
  body: definition.body.trim()
})

const buildSnapshotAssetId = (
  asset: WorkspaceAsset,
  cwd: string
) => (
  `${asset.kind}:${asset.origin}:${asset.instancePath ?? 'workspace'}:${asset.displayName}:${sanitizeValue(asset.sourcePath, cwd)}`
)

const summarizeBaseAsset = (
  asset: WorkspaceAsset,
  cwd: string,
  assetIdMap?: Map<string, string>
) => ({
  id: assetIdMap?.get(asset.id) ?? buildSnapshotAssetId(asset, cwd),
  kind: asset.kind,
  name: asset.name,
  displayName: asset.displayName,
  origin: asset.origin,
  scope: asset.scope,
  sourcePath: sanitizeValue(asset.sourcePath, cwd),
  instancePath: asset.instancePath,
  packageId: asset.packageId,
  resolvedBy: asset.resolvedBy,
  taskOverlaySource: asset.taskOverlaySource
})

const summarizeDocumentAsset = (
  asset: Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>,
  cwd: string,
  assetIdMap?: Map<string, string>
) => ({
  ...summarizeBaseAsset(asset, cwd, assetIdMap),
  definition: summarizeDefinition(asset.kind, asset.payload.definition, cwd)
})

const summarizeMcpServer = (
  asset: Extract<WorkspaceAsset, { kind: 'mcpServer' }>,
  cwd: string,
  assetIdMap?: Map<string, string>
) => ({
  ...summarizeBaseAsset(asset, cwd, assetIdMap),
  config: normalizeValue(asset.payload.config, cwd)
})

const summarizeHookPlugin = (
  asset: Extract<WorkspaceAsset, { kind: 'hookPlugin' }>,
  cwd: string,
  assetIdMap?: Map<string, string>
) => ({
  ...summarizeBaseAsset(asset, cwd, assetIdMap),
  packageName: asset.payload.packageName,
  config: normalizeValue(asset.payload.config, cwd)
})

const summarizeOpenCodeOverlayAsset = (
  asset: Extract<WorkspaceAsset, { kind: 'agent' | 'command' | 'mode' | 'nativePlugin' }>,
  cwd: string,
  assetIdMap?: Map<string, string>
) => ({
  ...summarizeBaseAsset(asset, cwd, assetIdMap),
  entryName: asset.payload.entryName,
  targetSubpath: asset.payload.targetSubpath
})

const summarizeDiagnostics = (
  diagnostics: AssetDiagnostic[],
  assetIdMap: Map<string, string>
) => (
  [...diagnostics]
    .sort((left, right) => {
      const assetIdDiff = left.assetId.localeCompare(right.assetId)
      if (assetIdDiff !== 0) return assetIdDiff
      return left.status.localeCompare(right.status)
    })
    .map(diagnostic => ({
      assetId: assetIdMap.get(diagnostic.assetId) ?? diagnostic.assetId,
      adapter: diagnostic.adapter,
      status: diagnostic.status,
      reason: diagnostic.reason,
      scope: diagnostic.scope,
      packageId: diagnostic.packageId
    }))
)

const summarizePlan = (
  plan: AdapterAssetPlan,
  cwd: string,
  assetIdMap: Map<string, string>
) => ({
  adapter: plan.adapter,
  mcpServers: normalizeValue(plan.mcpServers, cwd),
  overlays: [...plan.overlays]
    .sort((left, right) => left.assetId.localeCompare(right.assetId))
    .map(entry => ({
      assetId: assetIdMap.get(entry.assetId) ?? entry.assetId,
      kind: entry.kind,
      sourcePath: sanitizeValue(entry.sourcePath, cwd),
      targetPath: entry.targetPath
    })),
  diagnostics: summarizeDiagnostics(plan.diagnostics, assetIdMap)
})

const summarizeSelection = (
  resolution: PromptAssetResolution,
  options: {
    systemPrompt?: string
    tools?: Filter
    mcpServers?: Filter
    promptAssetIds?: string[]
  },
  cwd: string,
  assetIdMap: Map<string, string>
) => ({
  resolution: {
    rules: resolution.rules.map(rule => summarizeDefinition('rule', rule, cwd)),
    targetSkills: resolution.targetSkills.map(skill => summarizeDefinition('skill', skill, cwd)),
    entities: resolution.entities.map(entity => summarizeDefinition('entity', entity, cwd)),
    skills: resolution.skills.map(skill => summarizeDefinition('skill', skill, cwd)),
    specs: resolution.specs.map(spec => summarizeDefinition('spec', spec, cwd)),
    targetBody: resolution.targetBody.trim(),
    promptAssetIds: sortStrings(resolution.promptAssetIds.map(assetId => assetIdMap.get(assetId) ?? assetId))
  },
  options: {
    systemPrompt: options.systemPrompt?.trim(),
    tools: sortFilter(options.tools),
    mcpServers: sortFilter(options.mcpServers),
    promptAssetIds: options.promptAssetIds == null
      ? undefined
      : sortStrings(options.promptAssetIds.map(assetId => assetIdMap.get(assetId) ?? assetId))
  }
})

export const serializeWorkspaceAssetsSnapshot = (params: {
  cwd: string
  bundle: WorkspaceAssetBundle
  selection: {
    resolution: PromptAssetResolution
    options: {
      systemPrompt?: string
      tools?: Filter
      mcpServers?: Filter
      promptAssetIds?: string[]
    }
  }
  plans: AdapterAssetPlan[]
}) => {
  const { bundle, cwd } = params
  const assetIdMap = new Map(bundle.assets.map(asset => [asset.id, buildSnapshotAssetId(asset, cwd)]))

  const snapshot = {
    bundle: {
      cwd: '<workspace>',
      pluginConfigs: normalizeValue(bundle.pluginConfigs, cwd),
      pluginInstances: normalizeValue(bundle.pluginInstances, cwd),
      defaultIncludeMcpServers: sortStrings(bundle.defaultIncludeMcpServers),
      defaultExcludeMcpServers: sortStrings(bundle.defaultExcludeMcpServers),
      rules: bundle.rules.map(rule => summarizeDocumentAsset(rule, cwd, assetIdMap)),
      specs: bundle.specs.map(spec => summarizeDocumentAsset(spec, cwd, assetIdMap)),
      entities: bundle.entities.map(entity => summarizeDocumentAsset(entity, cwd, assetIdMap)),
      skills: bundle.skills.map(skill => summarizeDocumentAsset(skill, cwd, assetIdMap)),
      mcpServers: Object.values(bundle.mcpServers)
        .sort((left, right) => left.payload.name.localeCompare(right.payload.name))
        .map(server => summarizeMcpServer(server, cwd, assetIdMap)),
      hookPlugins: bundle.hookPlugins
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(plugin => summarizeHookPlugin(plugin, cwd, assetIdMap)),
      opencodeOverlayAssets: bundle.opencodeOverlayAssets
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(asset => summarizeOpenCodeOverlayAsset(asset, cwd, assetIdMap))
    },
    selection: summarizeSelection(
      params.selection.resolution,
      params.selection.options,
      cwd,
      assetIdMap
    ),
    plans: Object.fromEntries(
      [...params.plans]
        .sort((left, right) => left.adapter.localeCompare(right.adapter))
        .map(plan => [plan.adapter, summarizePlan(plan, cwd, assetIdMap)])
    )
  }

  return `${JSON.stringify(snapshot, null, 2)}\n`
}
