import type { Config } from './config'
import type { Definition, Entity, Filter, Rule, Skill, Spec } from './definition'
import type { PluginConfig, ResolvedPluginInstanceMetadata } from './plugin'

export type WorkspaceAssetKind = 'rule' | 'spec' | 'entity' | 'skill' | 'mcpServer' | 'hookPlugin'
export type WorkspaceAssetAdapter = 'claude-code' | 'codex' | 'opencode'
export type AssetDiagnosticStatus = 'native' | 'translated' | 'prompt' | 'skipped'

export interface AssetDiagnostic {
  assetId: string
  adapter: WorkspaceAssetAdapter
  status: AssetDiagnosticStatus
  reason: string
  packageId?: string
  scope?: string
  instancePath?: string
  origin: 'workspace' | 'plugin'
  resolvedBy?: string
  taskOverlaySource?: string
}

export interface AdapterOverlayEntry {
  assetId: string
  kind: 'skill'
  sourcePath: string
  targetPath: string
}

interface WorkspaceAssetBase<TKind extends WorkspaceAssetKind, TPayload> {
  id: string
  kind: TKind
  name: string
  displayName: string
  scope?: string
  origin: 'workspace' | 'plugin'
  sourcePath: string
  instancePath?: string
  packageId?: string
  resolvedBy?: string
  taskOverlaySource?: string
  payload: TPayload
}

interface WorkspaceDocumentPayload<TDefinition> {
  definition: TDefinition
}

interface WorkspaceMcpPayload {
  name: string
  config: NonNullable<Config['mcpServers']>[string]
}

interface WorkspaceHookPluginPayload {
  packageName?: string
  config: unknown
}

export type WorkspaceAsset =
  | WorkspaceAssetBase<'rule', WorkspaceDocumentPayload<Definition<Rule>>>
  | WorkspaceAssetBase<'spec', WorkspaceDocumentPayload<Definition<Spec>>>
  | WorkspaceAssetBase<'entity', WorkspaceDocumentPayload<Definition<Entity>>>
  | WorkspaceAssetBase<'skill', WorkspaceDocumentPayload<Definition<Skill>>>
  | WorkspaceAssetBase<'mcpServer', WorkspaceMcpPayload>
  | WorkspaceAssetBase<'hookPlugin', WorkspaceHookPluginPayload>

export interface WorkspaceAssetBundle {
  cwd: string
  pluginConfigs?: PluginConfig
  pluginInstances: ResolvedPluginInstanceMetadata[]
  assets: WorkspaceAsset[]
  rules: Array<Extract<WorkspaceAsset, { kind: 'rule' }>>
  specs: Array<Extract<WorkspaceAsset, { kind: 'spec' }>>
  entities: Array<Extract<WorkspaceAsset, { kind: 'entity' }>>
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>
  mcpServers: Record<string, Extract<WorkspaceAsset, { kind: 'mcpServer' }>>
  hookPlugins: Array<Extract<WorkspaceAsset, { kind: 'hookPlugin' }>>
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
  assetBundle?: WorkspaceAssetBundle
}

export interface AdapterAssetPlan {
  adapter: WorkspaceAssetAdapter
  diagnostics: AssetDiagnostic[]
  mcpServers: Record<string, NonNullable<Config['mcpServers']>[string]>
  overlays: AdapterOverlayEntry[]
}
