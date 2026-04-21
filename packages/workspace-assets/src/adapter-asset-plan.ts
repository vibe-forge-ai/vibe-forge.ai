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

import { resolveWorkspaceAssetSource } from './asset-source'
import { resolveNativeSkillDiagnosticReason, supportsNativeProjectSkills } from './adapter-capabilities'
import { resolveSelectedMcpNames, resolveSelectedSkillAssetsWithDependencies } from './selection-internal'

export async function buildAdapterAssetPlan(params: {
  adapter: WorkspaceAssetAdapter
  bundle: WorkspaceAssetBundle
  options: {
    mcpServers?: WorkspaceMcpSelection
    skills?: WorkspaceSkillSelection
    promptAssetIds?: string[]
  }
}): Promise<AdapterAssetPlan> {
  const diagnostics: AssetDiagnostic[] = []
  const pushDiagnostic = (
    asset: Parameters<typeof resolveWorkspaceAssetSource>[0] & {
      id: string
      packageId?: string
      scope?: string
      instancePath?: string
      taskOverlaySource?: string
    },
    diagnostic: Pick<AssetDiagnostic, 'adapter' | 'status' | 'reason'>
  ) => {
    diagnostics.push({
      assetId: asset.id,
      adapter: diagnostic.adapter,
      status: diagnostic.status,
      reason: diagnostic.reason,
      source: resolveWorkspaceAssetSource(asset),
      packageId: asset.packageId,
      scope: asset.scope,
      instancePath: asset.instancePath,
      origin: asset.origin,
      resolvedBy: asset.resolvedBy,
      taskOverlaySource: asset.taskOverlaySource
    })
  }

  for (const assetId of params.options.promptAssetIds ?? []) {
    const asset = params.bundle.assets.find(item => item.id === assetId)
    if (asset == null || asset.kind === 'mcpServer') continue
    pushDiagnostic(asset, {
      adapter: params.adapter,
      status: 'prompt',
      reason: 'Mapped into the generated system prompt.'
    })
  }

  const selectedMcpNames = resolveSelectedMcpNames(params.bundle, params.options.mcpServers)
  const mcpServers = Object.fromEntries(
    selectedMcpNames.map(name => [name, params.bundle.mcpServers[name].payload.config])
  )

  selectedMcpNames.forEach((name) => {
    const asset = params.bundle.mcpServers[name]
    pushDiagnostic(asset, {
      adapter: params.adapter,
      status: params.adapter === 'claude-code' ? 'native' : 'translated',
      reason: params.adapter === 'claude-code'
        ? 'Mapped into adapter MCP settings.'
        : 'Translated into adapter-specific MCP configuration.'
    })
  })

  params.bundle.hookPlugins.forEach((asset) => {
    pushDiagnostic(asset, {
      adapter: params.adapter,
      status: params.adapter === 'copilot' ? 'translated' : 'native',
      reason: params.adapter === 'claude-code'
        ? 'Mapped into the Claude Code native hooks bridge.'
        : params.adapter === 'codex'
        ? 'Mapped into the Codex native hooks bridge.'
        : params.adapter === 'gemini'
        ? 'Mapped into the Gemini native hooks bridge.'
        : params.adapter === 'copilot'
        ? 'Handled by the Vibe Forge task hook bridge.'
        : params.adapter === 'kimi'
        ? 'Mapped into the Kimi native hooks bridge.'
        : 'Mapped into the OpenCode native hooks bridge.'
    })
  })

  const selectedSkillAssets = await resolveSelectedSkillAssetsWithDependencies(params.bundle, params.options.skills)
  if (supportsNativeProjectSkills(params.adapter)) {
    selectedSkillAssets.forEach((asset) => {
      pushDiagnostic(asset, {
        adapter: params.adapter,
        status: 'native',
        reason: resolveNativeSkillDiagnosticReason(params.adapter)
      })
    })
  }
  if (params.adapter === 'opencode') {
    params.bundle.opencodeOverlayAssets.forEach((asset) => {
      pushDiagnostic(asset, {
        adapter: params.adapter,
        status: 'native',
        reason: 'Mirrored into OPENCODE_CONFIG_DIR as a native OpenCode asset.'
      })
    })
  } else if (params.adapter === 'codex' || params.adapter === 'copilot' || params.adapter === 'kimi') {
    params.bundle.opencodeOverlayAssets.forEach((asset) => {
      pushDiagnostic(asset, {
        adapter: params.adapter,
        status: 'skipped',
        reason: params.adapter === 'codex'
          ? 'No stable native Codex mapping exists for this asset kind in V1.'
          : params.adapter === 'copilot'
          ? 'No stable native Copilot mapping exists for this asset kind in V1.'
          : 'No stable native Kimi mapping exists for this asset kind in V1.'
      })
    })
  } else if (params.adapter === 'gemini') {
    params.bundle.opencodeOverlayAssets.forEach((asset) => {
      pushDiagnostic(asset, {
        adapter: params.adapter,
        status: 'skipped',
        reason: 'No stable native Gemini mapping exists for this asset kind in V1.'
      })
    })
  }

  const selectedSkillOverlays = selectedSkillAssets.map((asset): AdapterOverlayEntry => ({
    assetId: asset.id,
    kind: 'skill',
    sourcePath: dirname(asset.sourcePath),
    targetPath: `skills/${asset.displayName.replaceAll('/', '__')}`
  }))
  const overlays: AdapterOverlayEntry[] = params.adapter === 'opencode'
    ? [
      ...selectedSkillOverlays,
      ...params.bundle.opencodeOverlayAssets.map((asset): AdapterOverlayEntry => ({
        assetId: asset.id,
        kind: asset.kind,
        sourcePath: asset.sourcePath,
        targetPath: asset.payload.targetSubpath
      }))
    ]
    : params.adapter === 'copilot'
    ? selectedSkillOverlays
    : params.adapter === 'kimi'
    ? selectedSkillAssets.map((asset): AdapterOverlayEntry => ({
      assetId: asset.id,
      kind: 'skill',
      sourcePath: dirname(asset.sourcePath),
      targetPath: asset.displayName.replaceAll('/', '__')
    }))
    : []

  return {
    adapter: params.adapter,
    diagnostics,
    mcpServers,
    overlays
  }
}
