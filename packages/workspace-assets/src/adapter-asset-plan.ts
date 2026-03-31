import { basename, dirname } from 'node:path'

import type {
  AdapterAssetPlan,
  AssetDiagnostic,
  WorkspaceAssetAdapter,
  WorkspaceAssetBundle,
  WorkspaceMcpSelection,
  WorkspaceSkillSelection
} from '@vibe-forge/types'

import { filterSkillAssets } from './document-assets'
import { isOpenCodeOverlayAsset } from './internal-types'

const resolveMcpServerSelection = (
  bundle: WorkspaceAssetBundle,
  selection: WorkspaceMcpSelection | undefined
) => {
  const include = selection?.include ?? (
    bundle.defaultIncludeMcpServers.length > 0 ? bundle.defaultIncludeMcpServers : undefined
  )
  const exclude = selection?.exclude ?? (
    bundle.defaultExcludeMcpServers.length > 0 ? bundle.defaultExcludeMcpServers : undefined
  )

  return {
    include,
    exclude
  }
}

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
  const promptAssetIdSet = new Set(params.options.promptAssetIds ?? [])
  const mcpSelection = resolveMcpServerSelection(params.bundle, params.options.mcpServers)
  const selectedMcpServerNames = Object.keys(params.bundle.mcpServers).filter((name) => {
    if (mcpSelection.include != null && !mcpSelection.include.includes(name)) return false
    if (mcpSelection.exclude?.includes(name)) return false
    return true
  })
  const mcpServers = Object.fromEntries(
    selectedMcpServerNames.map((name) => [name, params.bundle.mcpServers[name].payload.config])
  )

  for (const assetId of promptAssetIdSet) {
    diagnostics.push({
      assetId,
      adapter: params.adapter,
      status: 'prompt',
      reason: 'Mapped into the generated system prompt.'
    })
  }

  for (const name of selectedMcpServerNames) {
    diagnostics.push({
      assetId: params.bundle.mcpServers[name].id,
      adapter: params.adapter,
      status: params.adapter === 'claude-code' ? 'native' : 'translated',
      reason: params.adapter === 'claude-code'
        ? 'Mapped into native MCP settings.'
        : 'Translated into adapter-specific MCP configuration.'
    })
  }

  for (const hookPlugin of params.bundle.hookPlugins) {
    const nativeHookReason = params.adapter === 'claude-code'
      ? 'Mapped into the isolated Claude Code native hooks bridge under .ai/.mock/.claude/settings.json.'
      : params.adapter === 'codex'
      ? 'Mapped into the isolated Codex native hooks bridge for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, and Stop.'
      : 'Mapped into the isolated OpenCode native hook plugin bridge under .ai/.mock/.config/opencode/plugins.'
    diagnostics.push({
      assetId: hookPlugin.id,
      adapter: params.adapter,
      status: 'native',
      reason: nativeHookReason
    })
  }

  const overlays: AdapterAssetPlan['overlays'] = []
  if (params.adapter === 'opencode') {
    const skillAssets = filterSkillAssets(params.bundle.skills, params.options.skills)
    for (const skillAsset of skillAssets) {
      overlays.push({
        assetId: skillAsset.id,
        kind: 'skill',
        sourcePath: dirname(skillAsset.payload.definition.path),
        targetPath: `skills/${basename(dirname(skillAsset.payload.definition.path))}`
      })
      diagnostics.push({
        assetId: skillAsset.id,
        adapter: 'opencode',
        status: 'native',
        reason: 'Mirrored into OPENCODE_CONFIG_DIR as a native skill.'
      })
    }

    for (const asset of params.bundle.assets) {
      if (!isOpenCodeOverlayAsset(asset)) continue
      if (!asset.targets.includes('opencode')) continue

      overlays.push({
        assetId: asset.id,
        kind: asset.kind,
        sourcePath: asset.payload.sourcePath,
        targetPath: asset.payload.targetSubpath
      })
      diagnostics.push({
        assetId: asset.id,
        adapter: 'opencode',
        status: 'native',
        reason: 'Mirrored into OPENCODE_CONFIG_DIR as a native OpenCode asset.'
      })
    }
  }

  if (params.adapter !== 'claude-code') {
    for (const asset of params.bundle.assets) {
      if (asset.kind !== 'nativePlugin' || !asset.enabled || !asset.targets.includes('claude-code')) continue
      diagnostics.push({
        assetId: asset.id,
        adapter: params.adapter,
        status: 'skipped',
        reason: 'Claude marketplace plugin settings do not have a native mapping for this adapter.'
      })
    }
  }

  if (params.adapter === 'codex') {
    for (const asset of params.bundle.assets) {
      if (!['nativePlugin', 'agent', 'command', 'mode'].includes(asset.kind)) continue
      if (asset.targets.includes('codex')) continue
      if (asset.kind === 'nativePlugin' && asset.targets.includes('claude-code')) continue
      diagnostics.push({
        assetId: asset.id,
        adapter: 'codex',
        status: 'skipped',
        reason: 'No stable native Codex mapping exists for this asset kind in V1.'
      })
    }
  }

  return {
    adapter: params.adapter,
    diagnostics,
    mcpServers,
    overlays,
    native: params.adapter === 'claude-code'
      ? {
        enabledPlugins: params.bundle.enabledPlugins,
        extraKnownMarketplaces: params.bundle.extraKnownMarketplaces
      }
      : params.adapter === 'codex' && params.bundle.hookPlugins.length > 0
      ? {
        codexHooks: {
          supportedEvents: [
            'SessionStart',
            'UserPromptSubmit',
            'PreToolUse',
            'PostToolUse',
            'Stop'
          ]
        }
      }
      : {}
  }
}
