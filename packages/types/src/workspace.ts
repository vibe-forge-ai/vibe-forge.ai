import type { Config } from './config'
import type { Definition, Entity, Filter, Rule, Skill, Spec } from './definition'

export type WorkspaceAssetKind =
  | 'rule'
  | 'spec'
  | 'entity'
  | 'skill'
  | 'mcpServer'
  | 'hookPlugin'
  | 'nativePlugin'
  | 'agent'
  | 'command'
  | 'mode'

export type WorkspaceAssetAdapter = 'claude-code' | 'codex' | 'opencode'

export type AssetDiagnosticStatus = 'native' | 'translated' | 'prompt' | 'skipped'

export interface AssetDiagnostic {
  assetId: string
  adapter: WorkspaceAssetAdapter
  status: AssetDiagnosticStatus
  reason: string
}

export interface AdapterOverlayEntry {
  assetId: string
  kind: Extract<WorkspaceAssetKind, 'skill' | 'nativePlugin' | 'agent' | 'command' | 'mode'>
  sourcePath: string
  targetPath: string
}

type WorkspaceAssetOrigin = 'project' | 'plugin' | 'config' | 'fallback'
type WorkspaceAssetScope = 'workspace' | 'project' | 'user' | 'adapter'

interface WorkspaceAssetBase<TKind extends WorkspaceAssetKind, TPayload> {
  id: string
  kind: TKind
  pluginId?: string
  origin: WorkspaceAssetOrigin
  scope: WorkspaceAssetScope
  enabled: boolean
  targets: WorkspaceAssetAdapter[]
  payload: TPayload
}

interface WorkspaceDocumentPayload<TDefinition> {
  definition: TDefinition
  sourcePath: string
}

interface WorkspaceHookPluginPayload {
  packageName?: string
  config: unknown
}

interface WorkspaceMcpPayload {
  name: string
  config: NonNullable<Config['mcpServers']>[string]
}

interface WorkspaceOverlayPayload {
  sourcePath: string
  entryName: string
  targetSubpath: string
}

interface WorkspaceConfigNativePluginPayload {
  name: string
  enabled: boolean
}

export type WorkspaceAsset =
  | WorkspaceAssetBase<'rule', WorkspaceDocumentPayload<Definition<Rule>>>
  | WorkspaceAssetBase<'spec', WorkspaceDocumentPayload<Definition<Spec>>>
  | WorkspaceAssetBase<'entity', WorkspaceDocumentPayload<Definition<Entity>>>
  | WorkspaceAssetBase<'skill', WorkspaceDocumentPayload<Definition<Skill>>>
  | WorkspaceAssetBase<'mcpServer', WorkspaceMcpPayload>
  | WorkspaceAssetBase<'hookPlugin', WorkspaceHookPluginPayload>
  | WorkspaceAssetBase<'nativePlugin', WorkspaceConfigNativePluginPayload | WorkspaceOverlayPayload>
  | WorkspaceAssetBase<'agent', WorkspaceOverlayPayload>
  | WorkspaceAssetBase<'command', WorkspaceOverlayPayload>
  | WorkspaceAssetBase<'mode', WorkspaceOverlayPayload>

export interface WorkspaceAssetBundle {
  cwd: string
  assets: WorkspaceAsset[]
  rules: Array<Extract<WorkspaceAsset, { kind: 'rule' }>>
  specs: Array<Extract<WorkspaceAsset, { kind: 'spec' }>>
  entities: Array<Extract<WorkspaceAsset, { kind: 'entity' }>>
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>
  mcpServers: Record<string, Extract<WorkspaceAsset, { kind: 'mcpServer' }>>
  hookPlugins: Array<Extract<WorkspaceAsset, { kind: 'hookPlugin' }>>
  enabledPlugins: Record<string, boolean>
  extraKnownMarketplaces: Config['extraKnownMarketplaces']
  defaultIncludeMcpServers: string[]
  defaultExcludeMcpServers: string[]
}

export interface PromptAssetResolution {
  rules: Definition<Rule>[]
  targetSkills: Definition<Skill>[]
  entities: Definition<Entity>[]
  skills: Definition<Skill>[]
  specs: Definition<Spec>[]
  targetBody: string
  promptAssetIds: string[]
}

export interface WorkspaceSkillSelection {
  include?: string[]
  exclude?: string[]
}

export interface WorkspaceMcpSelection {
  include?: string[]
  exclude?: string[]
}

export interface ResolvedPromptAssetOptions {
  systemPrompt?: string
  tools?: Filter
  mcpServers?: WorkspaceMcpSelection
  promptAssetIds?: string[]
}

export interface AdapterAssetPlan {
  adapter: WorkspaceAssetAdapter
  diagnostics: AssetDiagnostic[]
  mcpServers: Record<string, NonNullable<Config['mcpServers']>[string]>
  overlays: AdapterOverlayEntry[]
  native: {
    enabledPlugins?: Record<string, boolean>
    extraKnownMarketplaces?: Config['extraKnownMarketplaces']
    codexHooks?: {
      supportedEvents: string[]
    }
  }
}
