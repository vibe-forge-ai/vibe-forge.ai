import process from 'node:process'

import {
  DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
  buildConfigJsonVariables,
  loadConfig,
  resolveDefaultVibeForgeMcpServerConfig
} from '@vibe-forge/config'
import { DefinitionLoader } from '@vibe-forge/definition-loader'
import type { Config, WorkspaceAsset, WorkspaceAssetBundle } from '@vibe-forge/types'
import { resolveDocumentName, resolveSpecIdentifier } from '@vibe-forge/utils'

import {
  createDocumentAsset,
  dedupeDocumentAssets,
  dedupeDocumentAssetsByIdentifier,
  resolveRuleIdentifier,
  resolveSkillIdentifier
} from './document-assets'
import { mergeRecord, uniqueValues } from './helpers'
import {
  createClaudeNativePluginAssets,
  createHookPluginAssets,
  loadOpenCodeOverlayAssets,
  loadPluginMcpAssets
} from './plugin-assets'

const readConfigForWorkspace = async (cwd: string) => {
  return loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
}

export async function resolveWorkspaceAssetBundle(params: {
  cwd: string
  configs?: [Config?, Config?]
  useDefaultVibeForgeMcpServer?: boolean
}): Promise<WorkspaceAssetBundle> {
  const [config, userConfig] = params.configs ?? await readConfigForWorkspace(params.cwd)
  const enabledPlugins = mergeRecord(config?.enabledPlugins, userConfig?.enabledPlugins)
  const extraKnownMarketplaces = mergeRecord(config?.extraKnownMarketplaces, userConfig?.extraKnownMarketplaces)
  const loader = new DefinitionLoader(params.cwd)

  const [
    rawRules,
    rawSpecs,
    rawEntities,
    rawSkills,
    pluginMcpAssets,
    openCodeOverlayAssets
  ] = await Promise.all([
    loader.loadDefaultRules(),
    loader.loadDefaultSpecs(),
    loader.loadDefaultEntities(),
    loader.loadDefaultSkills(),
    loadPluginMcpAssets(params.cwd, enabledPlugins),
    loadOpenCodeOverlayAssets(params.cwd, enabledPlugins)
  ])

  const assets: WorkspaceAsset[] = []

  const rules = dedupeDocumentAssetsByIdentifier(
    dedupeDocumentAssets(
      rawRules.map((definition) => createDocumentAsset({ cwd: params.cwd, kind: 'rule', definition })),
      enabledPlugins
    ),
    asset => resolveRuleIdentifier(asset.payload.definition.path, asset.payload.definition.attributes.name)
  )
  const specs = dedupeDocumentAssetsByIdentifier(
    dedupeDocumentAssets(
      rawSpecs.map((definition) => createDocumentAsset({ cwd: params.cwd, kind: 'spec', definition })),
      enabledPlugins
    ),
    asset => resolveSpecIdentifier(asset.payload.definition.path, asset.payload.definition.attributes.name)
  )
  const entities = dedupeDocumentAssetsByIdentifier(
    dedupeDocumentAssets(
      rawEntities.map((definition) => createDocumentAsset({ cwd: params.cwd, kind: 'entity', definition })),
      enabledPlugins
    ),
    asset =>
      resolveDocumentName(
        asset.payload.definition.path,
        asset.payload.definition.attributes.name,
        ['readme.md', 'index.json']
      )
  )
  const skills = dedupeDocumentAssetsByIdentifier(
    dedupeDocumentAssets(
      rawSkills.map((definition) => createDocumentAsset({ cwd: params.cwd, kind: 'skill', definition })),
      enabledPlugins
    ),
    asset => resolveSkillIdentifier(asset.payload.definition.path, asset.payload.definition.attributes.name)
  )

  assets.push(...rules, ...specs, ...entities, ...skills)

  const mcpServers = new Map<string, Extract<WorkspaceAsset, { kind: 'mcpServer' }>>()
  if (params.useDefaultVibeForgeMcpServer !== false) {
    const defaultVibeForgeMcpServer = resolveDefaultVibeForgeMcpServerConfig()
    if (defaultVibeForgeMcpServer != null) {
      mcpServers.set(DEFAULT_VIBE_FORGE_MCP_SERVER_NAME, {
        id: `mcpServer:fallback:${DEFAULT_VIBE_FORGE_MCP_SERVER_NAME}`,
        kind: 'mcpServer',
        origin: 'fallback',
        scope: 'adapter',
        enabled: true,
        targets: ['claude-code', 'codex', 'opencode'],
        payload: {
          name: DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
          config: defaultVibeForgeMcpServer
        }
      })
    }
  }
  const userMcpServers = userConfig?.mcpServers ?? {}
  for (const [name, serverConfig] of Object.entries(userMcpServers)) {
    mcpServers.set(name, {
      id: `mcpServer:user:${name}`,
      kind: 'mcpServer',
      origin: 'config',
      scope: 'user',
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        name,
        config: serverConfig
      }
    })
  }
  for (const asset of pluginMcpAssets) {
    mcpServers.set(asset.payload.name, asset)
  }
  for (const [name, serverConfig] of Object.entries(config?.mcpServers ?? {})) {
    mcpServers.set(name, {
      id: `mcpServer:project:${name}`,
      kind: 'mcpServer',
      origin: 'config',
      scope: 'project',
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        name,
        config: serverConfig
      }
    })
  }
  assets.push(...mcpServers.values())

  const hookPlugins = [
    ...createHookPluginAssets(userConfig?.plugins, enabledPlugins, 'user'),
    ...createHookPluginAssets(config?.plugins, enabledPlugins, 'project')
  ]
  const claudeNativePlugins = createClaudeNativePluginAssets(enabledPlugins)
  assets.push(...hookPlugins, ...claudeNativePlugins, ...openCodeOverlayAssets)

  return {
    cwd: params.cwd,
    assets,
    rules,
    specs,
    entities,
    skills,
    mcpServers: Object.fromEntries(mcpServers.entries()),
    hookPlugins,
    enabledPlugins,
    extraKnownMarketplaces,
    defaultIncludeMcpServers: uniqueValues([
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ]),
    defaultExcludeMcpServers: uniqueValues([
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ])
  }
}
