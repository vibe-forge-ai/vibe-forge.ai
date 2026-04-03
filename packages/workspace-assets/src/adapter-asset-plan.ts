import { dirname } from 'node:path'

import type {
  AdapterAssetPlan,
  AdapterOverlayEntry,
  AssetDiagnostic,
  WorkspaceAssetAdapter,
  WorkspaceAssetBundle,
  WorkspaceMcpSelection,
  WorkspaceSkillSelection
} from '@vibe-forge/types'

import { resolveSelectedMcpNames, resolveSelectedSkillAssets } from './selection-internal'

export function buildAdapterAssetPlan(params: {
  adapter: WorkspaceAssetAdapter
  bundle: WorkspaceAssetBundle
  options: {
    mcpServers?: WorkspaceMcpSelection
    skills?: WorkspaceSkillSelection
    promptAssetIds?: string[]
  }
}): AdapterAssetPlan {
  const diagnostics: AssetDiagnostic[] = []

  for (const assetId of params.options.promptAssetIds ?? []) {
    const asset = params.bundle.assets.find(item => item.id === assetId)
    if (asset == null || asset.kind === 'mcpServer') continue
    diagnostics.push({
      assetId,
      adapter: params.adapter,
      status: 'prompt',
      reason: 'Mapped into the generated system prompt.',
      packageId: asset.packageId,
      scope: asset.scope,
      instancePath: asset.instancePath,
      origin: asset.origin,
      resolvedBy: asset.resolvedBy,
      taskOverlaySource: asset.taskOverlaySource
    })
  }

  const selectedMcpNames = resolveSelectedMcpNames(params.bundle, params.options.mcpServers)
  const mcpServers = Object.fromEntries(
    selectedMcpNames.map(name => [name, params.bundle.mcpServers[name].payload.config])
  )

  selectedMcpNames.forEach((name) => {
    const asset = params.bundle.mcpServers[name]
    diagnostics.push({
      assetId: asset.id,
      adapter: params.adapter,
      status: params.adapter === 'claude-code' ? 'native' : 'translated',
      reason: params.adapter === 'claude-code'
        ? 'Mapped into adapter MCP settings.'
        : 'Translated into adapter-specific MCP configuration.',
      packageId: asset.packageId,
      scope: asset.scope,
      instancePath: asset.instancePath,
      origin: asset.origin,
      resolvedBy: asset.resolvedBy,
      taskOverlaySource: asset.taskOverlaySource
    })
  })

  params.bundle.hookPlugins.forEach((asset) => {
    diagnostics.push({
      assetId: asset.id,
      adapter: params.adapter,
      status: 'native',
      reason: params.adapter === 'claude-code'
        ? 'Mapped into the Claude Code native hooks bridge.'
        : params.adapter === 'codex'
        ? 'Mapped into the Codex native hooks bridge.'
        : 'Mapped into the OpenCode native hooks bridge.',
      packageId: asset.packageId,
      scope: asset.scope,
      instancePath: asset.instancePath,
      origin: asset.origin,
      resolvedBy: asset.resolvedBy,
      taskOverlaySource: asset.taskOverlaySource
    })
  })

  const selectedSkillAssets = resolveSelectedSkillAssets(params.bundle.skills, params.options.skills)
  if (params.adapter === 'opencode') {
    selectedSkillAssets.forEach((asset) => {
      diagnostics.push({
        assetId: asset.id,
        adapter: params.adapter,
        status: 'native',
        reason: 'Mirrored into OPENCODE_CONFIG_DIR as a native skill.',
        packageId: asset.packageId,
        scope: asset.scope,
        instancePath: asset.instancePath,
        origin: asset.origin,
        resolvedBy: asset.resolvedBy,
        taskOverlaySource: asset.taskOverlaySource
      })
    })
    params.bundle.opencodeOverlayAssets.forEach((asset) => {
      diagnostics.push({
        assetId: asset.id,
        adapter: params.adapter,
        status: 'native',
        reason: 'Mirrored into OPENCODE_CONFIG_DIR as a native OpenCode asset.',
        packageId: asset.packageId,
        scope: asset.scope,
        instancePath: asset.instancePath,
        origin: asset.origin,
        resolvedBy: asset.resolvedBy,
        taskOverlaySource: asset.taskOverlaySource
      })
    })
  } else if (params.adapter === 'codex') {
    params.bundle.opencodeOverlayAssets.forEach((asset) => {
      diagnostics.push({
        assetId: asset.id,
        adapter: params.adapter,
        status: 'skipped',
        reason: 'No stable native Codex mapping exists for this asset kind in V1.',
        packageId: asset.packageId,
        scope: asset.scope,
        instancePath: asset.instancePath,
        origin: asset.origin,
        resolvedBy: asset.resolvedBy,
        taskOverlaySource: asset.taskOverlaySource
      })
    })
  }

  const overlays: AdapterOverlayEntry[] = params.adapter === 'opencode'
    ? [
      ...selectedSkillAssets.map((asset): AdapterOverlayEntry => ({
        assetId: asset.id,
        kind: 'skill',
        sourcePath: dirname(asset.sourcePath),
        targetPath: `skills/${asset.displayName.replaceAll('/', '__')}`
      })),
      ...params.bundle.opencodeOverlayAssets.map((asset): AdapterOverlayEntry => ({
        assetId: asset.id,
        kind: asset.kind,
        sourcePath: asset.sourcePath,
        targetPath: asset.payload.targetSubpath
      }))
    ]
    : []

  return {
    adapter: params.adapter,
    diagnostics,
    mcpServers,
    overlays
  }
}
