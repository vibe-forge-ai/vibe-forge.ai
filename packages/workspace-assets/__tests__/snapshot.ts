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

import { isOpenCodeOverlayAsset } from '#~/internal-types.js'

const sortStrings = (values: string[]) => [...values].sort((left, right) => left.localeCompare(right))

const isConfigNativePluginAsset = (
  asset: Extract<WorkspaceAsset, { kind: 'nativePlugin' }>
): asset is Extract<WorkspaceAsset, { kind: 'nativePlugin' }> & {
  payload: {
    name: string
    enabled: boolean
  }
} => !isOpenCodeOverlayAsset(asset)

const sanitizeValue = (
  value: string,
  cwd: string
) => (
  value
    .replaceAll(cwd, '<workspace>')
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

const summarizeDocumentAsset = (
  asset: Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>,
  cwd: string
) => ({
  id: asset.id,
  kind: asset.kind,
  origin: asset.origin,
  scope: asset.scope,
  pluginId: asset.pluginId,
  enabled: asset.enabled,
  targets: sortStrings(asset.targets),
  definition: summarizeDefinition(asset.kind, asset.payload.definition, cwd)
})

const summarizeMcpServer = (
  asset: Extract<WorkspaceAsset, { kind: 'mcpServer' }>,
  cwd: string
) => ({
  id: asset.id,
  origin: asset.origin,
  scope: asset.scope,
  pluginId: asset.pluginId,
  enabled: asset.enabled,
  targets: sortStrings(asset.targets),
  name: asset.payload.name,
  config: normalizeValue(asset.payload.config, cwd)
})

const summarizeHookPlugin = (
  asset: Extract<WorkspaceAsset, { kind: 'hookPlugin' }>,
  cwd: string
) => ({
  id: asset.id,
  origin: asset.origin,
  scope: asset.scope,
  pluginId: asset.pluginId,
  enabled: asset.enabled,
  targets: sortStrings(asset.targets),
  packageName: asset.payload.packageName,
  config: normalizeValue(asset.payload.config, cwd)
})

const summarizeNativePlugin = (
  asset: Extract<WorkspaceAsset, { kind: 'nativePlugin' }>,
  cwd: string
) => {
  if (isOpenCodeOverlayAsset(asset)) {
    return {
      id: asset.id,
      kind: asset.kind,
      origin: asset.origin,
      scope: asset.scope,
      pluginId: asset.pluginId,
      enabled: asset.enabled,
      targets: sortStrings(asset.targets),
      entryName: asset.payload.entryName,
      sourcePath: sanitizeValue(asset.payload.sourcePath, cwd),
      targetSubpath: asset.payload.targetSubpath
    }
  }

  return {
    id: asset.id,
    kind: asset.kind,
    origin: asset.origin,
    scope: asset.scope,
    pluginId: asset.pluginId,
    enabled: asset.enabled,
    targets: sortStrings(asset.targets),
    name: isConfigNativePluginAsset(asset) ? asset.payload.name : undefined
  }
}

const summarizeOverlayAsset = (
  asset:
    | Extract<WorkspaceAsset, { kind: 'agent' | 'command' | 'mode' }>
    | Extract<WorkspaceAsset, { kind: 'nativePlugin' }>,
  cwd: string
) => {
  if (!isOpenCodeOverlayAsset(asset)) {
    return summarizeNativePlugin(asset, cwd)
  }

  return {
    id: asset.id,
    kind: asset.kind,
    origin: asset.origin,
    scope: asset.scope,
    pluginId: asset.pluginId,
    enabled: asset.enabled,
    targets: sortStrings(asset.targets),
    entryName: asset.payload.entryName,
    sourcePath: sanitizeValue(asset.payload.sourcePath, cwd),
    targetSubpath: asset.payload.targetSubpath
  }
}

const summarizeDiagnostics = (diagnostics: AssetDiagnostic[]) => (
  [...diagnostics]
    .sort((left, right) => {
      const assetIdDiff = left.assetId.localeCompare(right.assetId)
      if (assetIdDiff !== 0) return assetIdDiff
      return left.status.localeCompare(right.status)
    })
    .map(diagnostic => ({
      assetId: diagnostic.assetId,
      adapter: diagnostic.adapter,
      status: diagnostic.status,
      reason: diagnostic.reason
    }))
)

const summarizePlan = (
  plan: AdapterAssetPlan,
  cwd: string
) => ({
  adapter: plan.adapter,
  mcpServers: normalizeValue(plan.mcpServers, cwd),
  overlays: [...plan.overlays]
    .sort((left, right) => left.assetId.localeCompare(right.assetId))
    .map(entry => ({
      assetId: entry.assetId,
      kind: entry.kind,
      sourcePath: sanitizeValue(entry.sourcePath, cwd),
      targetPath: entry.targetPath
    })),
  native: normalizeValue(plan.native, cwd),
  diagnostics: summarizeDiagnostics(plan.diagnostics)
})

const summarizeSelection = (
  resolution: PromptAssetResolution,
  options: {
    systemPrompt?: string
    tools?: Filter
    mcpServers?: Filter
    promptAssetIds?: string[]
  },
  cwd: string
) => ({
  resolution: {
    rules: resolution.rules.map(rule => summarizeDefinition('rule', rule, cwd)),
    targetSkills: resolution.targetSkills.map(skill => summarizeDefinition('skill', skill, cwd)),
    entities: resolution.entities.map(entity => summarizeDefinition('entity', entity, cwd)),
    skills: resolution.skills.map(skill => summarizeDefinition('skill', skill, cwd)),
    specs: resolution.specs.map(spec => summarizeDefinition('spec', spec, cwd)),
    targetBody: resolution.targetBody.trim(),
    promptAssetIds: sortStrings(resolution.promptAssetIds)
  },
  options: {
    systemPrompt: options.systemPrompt?.trim(),
    tools: sortFilter(options.tools),
    mcpServers: sortFilter(options.mcpServers),
    promptAssetIds: options.promptAssetIds == null ? undefined : sortStrings(options.promptAssetIds)
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
  const overlayAssets = bundle.assets.filter((
    asset
  ): asset is
    | Extract<WorkspaceAsset, { kind: 'agent' | 'command' | 'mode' }>
    | Extract<WorkspaceAsset, { kind: 'nativePlugin' }> => (
      asset.kind === 'agent' ||
      asset.kind === 'command' ||
      asset.kind === 'mode' ||
      (asset.kind === 'nativePlugin' && isOpenCodeOverlayAsset(asset))
    )
  )
  const claudeNativePlugins = bundle.assets.filter((
    asset
  ): asset is Extract<WorkspaceAsset, { kind: 'nativePlugin' }> => (
    asset.kind === 'nativePlugin' && !isOpenCodeOverlayAsset(asset)
  ))

  const snapshot = {
    bundle: {
      cwd: '<workspace>',
      enabledPlugins: normalizeValue(bundle.enabledPlugins, cwd),
      extraKnownMarketplaces: normalizeValue(bundle.extraKnownMarketplaces, cwd),
      defaultIncludeMcpServers: sortStrings(bundle.defaultIncludeMcpServers),
      defaultExcludeMcpServers: sortStrings(bundle.defaultExcludeMcpServers),
      rules: bundle.rules.map(rule => summarizeDocumentAsset(rule, cwd)),
      specs: bundle.specs.map(spec => summarizeDocumentAsset(spec, cwd)),
      entities: bundle.entities.map(entity => summarizeDocumentAsset(entity, cwd)),
      skills: bundle.skills.map(skill => summarizeDocumentAsset(skill, cwd)),
      mcpServers: Object.values(bundle.mcpServers)
        .sort((left, right) => left.payload.name.localeCompare(right.payload.name))
        .map(server => summarizeMcpServer(server, cwd)),
      hookPlugins: bundle.hookPlugins
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(plugin => summarizeHookPlugin(plugin, cwd)),
      claudeNativePlugins: claudeNativePlugins
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(asset => summarizeNativePlugin(asset, cwd)),
      opencodeOverlayAssets: overlayAssets
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(asset => summarizeOverlayAsset(asset, cwd))
    },
    selection: summarizeSelection(
      params.selection.resolution,
      params.selection.options,
      cwd
    ),
    plans: Object.fromEntries(
      [...params.plans]
        .sort((left, right) => left.adapter.localeCompare(right.adapter))
        .map(plan => [plan.adapter, summarizePlan(plan, cwd)])
    )
  }

  return `${JSON.stringify(snapshot, null, 2)}\n`
}
