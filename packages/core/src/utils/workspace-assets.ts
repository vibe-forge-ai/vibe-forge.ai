import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { basename, dirname, extname, relative } from 'node:path'

import { glob } from 'fast-glob'
import yaml from 'js-yaml'

import type { Config } from '../config'
import { loadConfig } from '../config/load'
import {
  DefinitionLoader,
  type Definition,
  type Entity,
  type Filter,
  type Rule,
  type Skill,
  type Spec
} from './definition-loader'

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

interface WorkspaceAssetBase<TKind extends WorkspaceAssetKind, TPayload> {
  id: string
  kind: TKind
  pluginId?: string
  origin: 'project' | 'plugin' | 'config' | 'fallback'
  scope: 'workspace' | 'project' | 'user' | 'adapter'
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

interface WorkspaceNativePluginPayload {
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
  | WorkspaceAssetBase<'nativePlugin', WorkspaceNativePluginPayload>
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

const normalizePath = (value: string) => value.split('\\').join('/')

const resolveRelativePath = (cwd: string, value: string) => normalizePath(relative(cwd, value))

const resolveDocumentName = (
  path: string,
  explicitName?: string,
  indexFileNames: string[] = []
) => {
  const trimmedName = explicitName?.trim()
  if (trimmedName) return trimmedName

  const fileName = basename(path).toLowerCase()
  if (indexFileNames.includes(fileName)) {
    return basename(dirname(path))
  }

  return basename(path).replace(/\.[^/.]+$/, '')
}

const resolveSpecIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['index.md'])
)

const resolvePluginIdFromPath = (cwd: string, path: string) => {
  const relativePath = resolveRelativePath(cwd, path)
  const match = relativePath.match(/^\.ai\/plugins\/([^/]+)\//)
  return match?.[1]
}

const isPluginEnabled = (
  enabledPlugins: Record<string, boolean>,
  pluginId?: string
) => pluginId == null || enabledPlugins[pluginId] !== false

const mergeRecord = <T>(left?: Record<string, T>, right?: Record<string, T>) => ({
  ...(left ?? {}),
  ...(right ?? {})
})

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const assetOriginPriority: Record<WorkspaceAsset['origin'], number> = {
  project: 0,
  plugin: 1,
  config: 2,
  fallback: 3
}

const readConfigForWorkspace = async (cwd: string) => {
  const jsonVariables: Record<string, string | null | undefined> = {
    ...process.env,
    WORKSPACE_FOLDER: cwd,
    __VF_PROJECT_WORKSPACE_FOLDER__: cwd
  }
  return loadConfig({ jsonVariables })
}

const toAssetScope = (origin: WorkspaceAsset['origin']): WorkspaceAsset['scope'] => (
  origin === 'config'
    ? 'project'
    : origin === 'fallback'
    ? 'adapter'
    : 'workspace'
)

const pushAsset = <TAsset extends WorkspaceAsset>(
  collection: TAsset[],
  next: TAsset
) => {
  collection.push(next)
  return next
}

const createDocumentAsset = <TKind extends Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>, TDefinition>(
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

const parseStructuredDocument = async (path: string) => {
  const raw = await readFile(path, 'utf8')
  const extension = extname(path).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return yaml.load(raw)
  }
  return JSON.parse(raw)
}

const loadPluginMcpAssets = async (
  cwd: string,
  enabledPlugins: Record<string, boolean>
) => {
  const paths = await glob([
    '.ai/plugins/*/mcp/*.json',
    '.ai/plugins/*/mcp/*.yaml',
    '.ai/plugins/*/mcp/*.yml'
  ], {
    cwd,
    absolute: true
  })

  const entries = await Promise.all(paths.map(async (path) => {
    const pluginId = resolvePluginIdFromPath(cwd, path)
    if (!isPluginEnabled(enabledPlugins, pluginId)) return undefined

    const parsed = await parseStructuredDocument(path)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined

    const record = parsed as Record<string, unknown>
    const name = typeof record.name === 'string' && record.name.trim() !== ''
      ? record.name.trim()
      : basename(path, extname(path))
    const { name: _name, ...config } = record

    return {
      id: `mcpServer:${resolveRelativePath(cwd, path)}`,
      kind: 'mcpServer',
      pluginId,
      origin: 'plugin',
      scope: 'workspace',
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        name,
        config: config as NonNullable<Config['mcpServers']>[string]
      }
    } satisfies Extract<WorkspaceAsset, { kind: 'mcpServer' }>
  }))

  return entries.filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

const loadOpenCodeOverlayAssets = async (
  cwd: string,
  enabledPlugins: Record<string, boolean>
) => {
  const paths = await glob([
    '.ai/plugins/*/opencode/plugins/*',
    '.ai/plugins/*/opencode/agents/*',
    '.ai/plugins/*/opencode/commands/*',
    '.ai/plugins/*/opencode/modes/*'
  ], {
    cwd,
    absolute: true,
    onlyFiles: false
  })

  return paths
    .map((path) => {
      const relativePath = resolveRelativePath(cwd, path)
      const match = relativePath.match(/^\.ai\/plugins\/([^/]+)\/opencode\/(plugins|agents|commands|modes)\/([^/]+)$/)
      if (!match) return undefined

      const [, pluginId, rawFolder, entryName] = match
      if (!isPluginEnabled(enabledPlugins, pluginId)) return undefined

      const kind = {
        plugins: 'nativePlugin',
        agents: 'agent',
        commands: 'command',
        modes: 'mode'
      }[rawFolder] as Extract<WorkspaceAssetKind, 'nativePlugin' | 'agent' | 'command' | 'mode'>

      return {
        id: `${kind}:${relativePath}`,
        kind,
        pluginId,
        origin: 'plugin',
        scope: 'workspace',
        enabled: true,
        targets: ['opencode'],
        payload: {
          sourcePath: path,
          entryName,
          targetSubpath: `${rawFolder}/${entryName}`
        }
      } satisfies Extract<WorkspaceAsset, { kind: typeof kind }>
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

const createHookPluginAssets = (
  config: Config['plugins'],
  enabledPlugins: Record<string, boolean>,
  scope: Extract<WorkspaceAsset['scope'], 'project' | 'user'>
) => {
  if (config == null || Array.isArray(config)) return [] as Array<Extract<WorkspaceAsset, { kind: 'hookPlugin' }>>

  return Object.entries(config)
    .filter((entry) => enabledPlugins[entry[0]] !== false)
    .map(([pluginId, pluginConfig]) => ({
      id: `hookPlugin:${scope}:${pluginId}`,
      kind: 'hookPlugin',
      pluginId,
      origin: 'config',
      scope,
      enabled: true,
      targets: ['claude-code', 'codex', 'opencode'],
      payload: {
        packageName: pluginId,
        config: pluginConfig
      }
    } satisfies Extract<WorkspaceAsset, { kind: 'hookPlugin' }>))
}

const createClaudeNativePluginAssets = (
  enabledPlugins: Record<string, boolean>
) => {
  return Object.entries(enabledPlugins).map(([pluginId, enabled]) => ({
    id: `nativePlugin:claude-code:${pluginId}`,
    kind: 'nativePlugin',
    pluginId,
    origin: 'config',
    scope: 'project',
    enabled,
    targets: ['claude-code'],
    payload: {
      name: pluginId,
      enabled
    }
  } satisfies Extract<WorkspaceAsset, { kind: 'nativePlugin' }>))
}

const dedupeDocumentAssets = <TAsset extends Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>>(
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

const dedupeDocumentAssetsByIdentifier = <TAsset extends Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>>(
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

const resolveRuleIdentifier = (
  path: string,
  explicitName?: string
) => resolveDocumentName(path, explicitName)

const resolveSkillIdentifier = (
  path: string,
  explicitName?: string
) => resolveDocumentName(path, explicitName, ['skill.md'])

const pickSpecAsset = (
  bundle: WorkspaceAssetBundle,
  name: string
) => {
  const assets = bundle.specs.filter((asset) => {
    const definition = asset.payload.definition
    return resolveSpecIdentifier(definition.path, definition.attributes.name) === name
  })
  return assets.find(asset => asset.origin === 'project') ?? assets[0]
}

const pickEntityAsset = (
  bundle: WorkspaceAssetBundle,
  name: string
) => {
  const assets = bundle.entities.filter((asset) => {
    const definition = asset.payload.definition
    const identifier = resolveDocumentName(definition.path, definition.attributes.name, ['readme.md', 'index.json'])
    return identifier === name
  })
  return assets.find(asset => asset.origin === 'project') ?? assets[0]
}

const filterSkillAssets = (
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>,
  selection?: WorkspaceSkillSelection
) => {
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

const dedupeSkillAssets = (skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>) => {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    if (seen.has(skill.payload.definition.path)) return false
    seen.add(skill.payload.definition.path)
    return true
  })
}

const resolveSelectedRuleAssets = async (
  bundle: WorkspaceAssetBundle,
  patterns: string[]
) => {
  const matchedPaths = new Set(
    (await glob(patterns, { cwd: bundle.cwd, absolute: true }))
      .map(normalizePath)
  )
  return bundle.rules.filter((asset) => matchedPaths.has(normalizePath(asset.payload.definition.path)))
}

const toDocumentDefinitions = <TDefinition>(
  assets: Array<WorkspaceDocumentAsset<TDefinition>>
) => assets.map(asset => asset.payload.definition)

type WorkspaceDocumentAsset<TDefinition> = Extract<
  WorkspaceAsset,
  { kind: 'rule' | 'spec' | 'entity' | 'skill' }
> & {
  payload: WorkspaceDocumentPayload<TDefinition & { path: string }>
}

const toPromptAssetIds = (assets: Array<{ id: string }>) => uniqueValues(assets.map(asset => asset.id))

export async function resolveWorkspaceAssetBundle(params: {
  cwd: string
  configs?: [Config?, Config?]
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
    asset => resolveDocumentName(
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

export async function resolvePromptAssetSelection(
  params: {
    bundle: WorkspaceAssetBundle
    type: 'spec' | 'entity' | undefined
    name?: string
    input?: {
      skills?: WorkspaceSkillSelection
    }
  }
): Promise<[PromptAssetResolution, ResolvedPromptAssetOptions]> {
  const loader = new DefinitionLoader(params.bundle.cwd)
  const options: ResolvedPromptAssetOptions = {}
  const systemPromptParts: string[] = []

  const entities = params.type !== 'entity'
    ? toDocumentDefinitions(params.bundle.entities)
    : []
  const skills = toDocumentDefinitions(
    filterSkillAssets(params.bundle.skills, params.input?.skills)
  )
  const rules = toDocumentDefinitions(params.bundle.rules)
  const specs = toDocumentDefinitions(params.bundle.specs)

  const promptAssetIds = new Set<string>([
    ...toPromptAssetIds(params.bundle.rules),
    ...(params.type !== 'entity' ? toPromptAssetIds(params.bundle.entities) : []),
    ...toPromptAssetIds(params.bundle.specs),
    ...toPromptAssetIds(filterSkillAssets(params.bundle.skills, params.input?.skills))
  ])

  const targetSkillsAssets: Array<Extract<WorkspaceAsset, { kind: 'skill' }>> = []
  let targetBody = ''
  let targetToolsFilter: Filter | undefined
  let targetMcpServersFilter: Filter | undefined
  let selectedSkillAssets: Array<Extract<WorkspaceAsset, { kind: 'skill' }>> = []

  if (params.input?.skills?.include != null && params.input.skills.include.length > 0) {
    selectedSkillAssets = dedupeSkillAssets(
      filterSkillAssets(params.bundle.skills, { include: params.input.skills.include })
    )
  }

  if (params.type && params.name) {
    const targetAsset = params.type === 'spec'
      ? pickSpecAsset(params.bundle, params.name)
      : pickEntityAsset(params.bundle, params.name)

    if (targetAsset == null) {
      throw new Error(`Failed to load ${params.type} ${params.name}`)
    }

    const { definition } = targetAsset.payload
    const { attributes, body } = definition
    promptAssetIds.add(targetAsset.id)

    if (attributes.rules) {
      const matchedRuleAssets = await resolveSelectedRuleAssets(params.bundle, attributes.rules)
      rules.push(
        ...matchedRuleAssets.map((asset) => ({
          ...asset.payload.definition,
          attributes: {
            ...asset.payload.definition.attributes,
            always: true
          }
        }))
      )
      for (const asset of matchedRuleAssets) {
        promptAssetIds.add(asset.id)
      }
    }

    if (attributes.skills) {
      for (const skillAsset of params.bundle.skills) {
        const skillName = basename(dirname(skillAsset.payload.definition.path))
        if (!attributes.skills.includes(skillName)) continue
        targetSkillsAssets.push(skillAsset)
        promptAssetIds.add(skillAsset.id)
      }
    }

    targetBody = body
    targetToolsFilter = attributes.tools
    targetMcpServersFilter = attributes.mcpServers
  }

  const targetSkills = toDocumentDefinitions(targetSkillsAssets)
  const selectedSkillsPrompt = toDocumentDefinitions(
    selectedSkillAssets.filter(
      skill => !targetSkillsAssets.some(target => target.payload.definition.path === skill.payload.definition.path)
    )
  )

  systemPromptParts.push(loader.generateRulesPrompt(rules))
  systemPromptParts.push(loader.generateSkillsPrompt(targetSkills))
  systemPromptParts.push(loader.generateSkillsPrompt(selectedSkillsPrompt))
  systemPromptParts.push(loader.generateEntitiesRoutePrompt(entities))
  systemPromptParts.push(loader.generateSkillsRoutePrompt(skills))
  systemPromptParts.push(loader.generateSpecRoutePrompt(specs))
  systemPromptParts.push(targetBody)

  if (targetToolsFilter) {
    options.tools = targetToolsFilter
  }
  if (targetMcpServersFilter) {
    options.mcpServers = targetMcpServersFilter
  }

  options.systemPrompt = systemPromptParts.join('\n\n')
  options.promptAssetIds = Array.from(promptAssetIds)

  return [
    {
      rules,
      targetSkills,
      entities,
      skills,
      specs,
      targetBody,
      promptAssetIds: Array.from(promptAssetIds)
    },
    options
  ]
}

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

  const overlays: AdapterOverlayEntry[] = []
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
      if (!['nativePlugin', 'agent', 'command', 'mode'].includes(asset.kind)) continue
      if (!asset.targets.includes('opencode')) continue

      const payload = asset.payload as WorkspaceOverlayPayload
      overlays.push({
        assetId: asset.id,
        kind: asset.kind,
        sourcePath: payload.sourcePath,
        targetPath: payload.targetSubpath
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
