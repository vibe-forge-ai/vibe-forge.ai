import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import process from 'node:process'

import {
  DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
  buildConfigJsonVariables,
  loadConfig,
  resolveDefaultVibeForgeMcpServerConfig
} from '@vibe-forge/config'
import type { Config, Definition, Entity, PluginConfig, WorkspaceAsset, WorkspaceAssetKind } from '@vibe-forge/types'
import { resolveProjectAiBaseDir, resolveProjectAiEntitiesDir, resolveRelativePath } from '@vibe-forge/utils'
import { listManagedPluginInstalls, toManagedPluginConfig } from '@vibe-forge/utils/managed-plugin'
import {
  flattenPluginInstances,
  mergePluginConfigs,
  resolveConfiguredPluginInstances,
  resolvePluginHooksEntryPathForInstance
} from '@vibe-forge/utils/plugin-resolver'
import type { ResolvedPluginInstance } from '@vibe-forge/utils/plugin-resolver'
import { glob } from 'fast-glob'
import fm from 'front-matter'
import yaml from 'js-yaml'

import {
  resolveDocumentName,
  resolveEntityIdentifier,
  resolveSkillIdentifier,
  resolveSpecIdentifier
} from '@vibe-forge/definition-core'

import { findSkillDependencyAsset, normalizeSkillDependencies } from './skill-dependencies'
import { installRegistrySkillDependency } from './skill-registry'

type DocumentAssetKind = Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>
type OpenCodeOverlayKind = Extract<WorkspaceAssetKind, 'agent' | 'command' | 'mode' | 'nativePlugin'>
type OpenCodeOverlayAsset<TKind extends OpenCodeOverlayKind> = Extract<WorkspaceAsset, { kind: TKind }>

type DocumentAsset<TDefinition> = Extract<WorkspaceAsset, { kind: DocumentAssetKind }> & {
  payload: {
    definition: TDefinition & { path: string }
  }
}

interface OpenCodeOverlayAssetEntry {
  kind: OpenCodeOverlayKind
  sourcePath: string
  entryName: string
  targetSubpath: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const resolveDisplayName = (name: string, scope?: string) => (
  scope != null && scope.trim() !== '' ? `${scope}/${name}` : name
)

const loadWorkspaceConfig = async (cwd: string) => (
  loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
)

const parseFrontmatterDocument = async <TDefinition extends object>(
  path: string
): Promise<Definition<TDefinition>> => {
  const content = await readFile(path, 'utf-8')
  const { body, attributes } = fm<TDefinition>(content)
  return {
    path,
    body,
    attributes
  }
}

const parseEntityIndexJson = async (path: string): Promise<Definition<Entity>> => {
  const raw = JSON.parse(await readFile(path, 'utf-8')) as Record<string, unknown>
  const promptPath = typeof raw.promptPath === 'string'
    ? (raw.promptPath.startsWith('/') ? raw.promptPath : resolve(dirname(path), raw.promptPath))
    : undefined
  const prompt = typeof raw.prompt === 'string'
    ? raw.prompt
    : promptPath != null
    ? await readFile(promptPath, 'utf-8')
    : ''

  return {
    path,
    body: prompt,
    attributes: raw as Entity
  }
}

const parseStructuredMcpFile = async (path: string) => {
  const raw = await readFile(path, 'utf8')
  const extension = extname(path).toLowerCase()
  return extension === '.yaml' || extension === '.yml'
    ? yaml.load(raw)
    : JSON.parse(raw)
}

const createDocumentAsset = <
  TKind extends DocumentAssetKind,
  TDefinition extends { path: string; attributes: { name?: string } },
>(params: {
  cwd: string
  kind: TKind
  definition: TDefinition
  origin: 'workspace' | 'plugin'
  scope?: string
  instance?: ResolvedPluginInstance
}) => {
  const name = ({
    rule: resolveDocumentName,
    spec: resolveSpecIdentifier,
    entity: resolveEntityIdentifier,
    skill: resolveSkillIdentifier
  }[params.kind])(params.definition.path, params.definition.attributes.name)
  const displayName = resolveDisplayName(name, params.scope)

  return {
    id: `${params.kind}:${params.origin}:${params.instance?.instancePath ?? 'workspace'}:${displayName}:${
      resolveRelativePath(params.cwd, params.definition.path)
    }`,
    kind: params.kind,
    name,
    displayName,
    scope: params.scope,
    origin: params.origin,
    sourcePath: params.definition.path,
    instancePath: params.instance?.instancePath,
    packageId: params.instance?.packageId,
    resolvedBy: params.instance?.resolvedBy,
    taskOverlaySource: params.instance?.overlaySource,
    payload: {
      definition: params.definition
    }
  } as Extract<WorkspaceAsset, { kind: TKind }>
}

const createMcpAsset = (params: {
  cwd: string
  name: string
  config: NonNullable<Config['mcpServers']>[string]
  origin: 'workspace' | 'plugin'
  scope?: string
  sourcePath: string
  instance?: ResolvedPluginInstance
}) => {
  const displayName = resolveDisplayName(params.name, params.scope)
  return {
    id: `mcpServer:${params.origin}:${params.instance?.instancePath ?? 'workspace'}:${displayName}:${
      resolveRelativePath(params.cwd, params.sourcePath)
    }`,
    kind: 'mcpServer',
    name: params.name,
    displayName,
    scope: params.scope,
    origin: params.origin,
    sourcePath: params.sourcePath,
    instancePath: params.instance?.instancePath,
    packageId: params.instance?.packageId,
    resolvedBy: params.instance?.resolvedBy,
    taskOverlaySource: params.instance?.overlaySource,
    payload: {
      name: displayName,
      config: params.config
    }
  } satisfies Extract<WorkspaceAsset, { kind: 'mcpServer' }>
}

const createHookPluginAsset = (
  instance: ResolvedPluginInstance
) => ({
  id: `hookPlugin:${instance.instancePath}:${instance.packageId ?? instance.requestId}`,
  kind: 'hookPlugin',
  name: instance.requestId,
  displayName: resolveDisplayName(instance.requestId, instance.scope),
  scope: instance.scope,
  origin: 'plugin' as const,
  sourcePath: instance.rootDir,
  instancePath: instance.instancePath,
  packageId: instance.packageId,
  resolvedBy: instance.resolvedBy,
  taskOverlaySource: instance.overlaySource,
  payload: {
    packageName: instance.packageId,
    config: instance.options
  }
} satisfies Extract<WorkspaceAsset, { kind: 'hookPlugin' }>)

const createOpenCodeOverlayAsset = <TKind extends OpenCodeOverlayKind>(params: {
  cwd: string
  kind: TKind
  sourcePath: string
  entryName: string
  targetSubpath: string
  instance: ResolvedPluginInstance
}): OpenCodeOverlayAsset<TKind> => ({
  id: `${params.kind}:plugin:${params.instance.instancePath}:${
    resolveDisplayName(params.entryName, params.instance.scope)
  }:${resolveRelativePath(params.cwd, params.sourcePath)}`,
  kind: params.kind,
  name: params.entryName,
  displayName: resolveDisplayName(params.entryName, params.instance.scope),
  scope: params.instance.scope,
  origin: 'plugin' as const,
  sourcePath: params.sourcePath,
  instancePath: params.instance.instancePath,
  packageId: params.instance.packageId,
  resolvedBy: params.instance.resolvedBy,
  taskOverlaySource: params.instance.overlaySource,
  payload: {
    entryName: params.entryName,
    targetSubpath: params.targetSubpath
  }
} as OpenCodeOverlayAsset<TKind>)

const scanWorkspaceDocuments = async (cwd: string) => {
  const aiBaseDir = resolveProjectAiBaseDir(cwd, process.env)
  const entitiesDir = resolveProjectAiEntitiesDir(cwd, process.env)
  const [rulePaths, skillPaths, specPaths, entityDocPaths, entityJsonPaths, mcpPaths] = await Promise.all([
    glob(['rules/*.md'], { cwd: aiBaseDir, absolute: true }),
    glob(['skills/*/SKILL.md'], { cwd: aiBaseDir, absolute: true }),
    glob(['specs/*.md', 'specs/*/index.md'], { cwd: aiBaseDir, absolute: true }),
    glob(['*.md', '*/README.md'], { cwd: entitiesDir, absolute: true }),
    glob(['*/index.json'], { cwd: entitiesDir, absolute: true }),
    glob(['mcp/*.json', 'mcp/*.yaml', 'mcp/*.yml'], { cwd: aiBaseDir, absolute: true })
  ])

  return {
    rulePaths,
    skillPaths,
    specPaths,
    entityDocPaths,
    entityJsonPaths,
    mcpPaths
  }
}

const scanInstanceDocuments = async (instance: ResolvedPluginInstance) => {
  const assets = instance.manifest?.assets
  const resolveAssetRoot = (dir: string | undefined, fallback: string) => resolve(instance.rootDir, dir ?? fallback)

  const [rulePaths, skillPaths, specPaths, entityDocPaths, entityJsonPaths, mcpPaths] = await Promise.all([
    glob(['*.md'], { cwd: resolveAssetRoot(assets?.rules, 'rules'), absolute: true }).catch(() => [] as string[]),
    glob(['*/SKILL.md'], { cwd: resolveAssetRoot(assets?.skills, 'skills'), absolute: true }).catch(() =>
      [] as string[]
    ),
    glob(['*.md', '*/index.md'], { cwd: resolveAssetRoot(assets?.specs, 'specs'), absolute: true }).catch(() =>
      [] as string[]
    ),
    glob(['*.md', '*/README.md'], { cwd: resolveAssetRoot(assets?.entities, 'entities'), absolute: true }).catch(() =>
      [] as string[]
    ),
    glob(['*/index.json'], { cwd: resolveAssetRoot(assets?.entities, 'entities'), absolute: true }).catch(() =>
      [] as string[]
    ),
    glob(['*.json', '*.yaml', '*.yml'], { cwd: resolveAssetRoot(assets?.mcp, 'mcp'), absolute: true }).catch(() =>
      [] as string[]
    )
  ])

  return {
    rulePaths,
    skillPaths,
    specPaths,
    entityDocPaths,
    entityJsonPaths,
    mcpPaths
  }
}

const toOpenCodeOverlayEntries = (
  kind: OpenCodeOverlayKind,
  targetDir: 'agents' | 'commands' | 'modes' | 'plugins',
  paths: string[]
): OpenCodeOverlayAssetEntry[] =>
  paths.map((sourcePath) => ({
    kind,
    sourcePath,
    entryName: basename(sourcePath, extname(sourcePath)),
    targetSubpath: `${targetDir}/${basename(sourcePath)}`
  }))

const scanInstanceOpenCodeOverlays = async (
  instance: ResolvedPluginInstance
) => {
  const opencodeRoot = resolve(instance.rootDir, 'opencode')
  const [agentPaths, commandPaths, modePaths, nativePluginPaths] = await Promise.all([
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'agents'), absolute: true, onlyFiles: true }).catch(() =>
      [] as string[]
    ),
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'commands'), absolute: true, onlyFiles: true }).catch(() =>
      [] as string[]
    ),
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'modes'), absolute: true, onlyFiles: true }).catch(() =>
      [] as string[]
    ),
    glob(['**/*'], { cwd: resolve(opencodeRoot, 'plugins'), absolute: true, onlyFiles: true }).catch(() =>
      [] as string[]
    )
  ])

  return [
    ...toOpenCodeOverlayEntries('agent', 'agents', agentPaths),
    ...toOpenCodeOverlayEntries('command', 'commands', commandPaths),
    ...toOpenCodeOverlayEntries('mode', 'modes', modePaths),
    ...toOpenCodeOverlayEntries('nativePlugin', 'plugins', nativePluginPaths)
  ]
}

const assertNoDocumentConflicts = (
  assets: Array<Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>>
) => {
  const seen = new Map<string, WorkspaceAsset>()
  for (const asset of assets) {
    const key = `${asset.kind}:${asset.displayName}`
    const existing = seen.get(key)
    if (existing != null) {
      throw new Error(
        `Duplicate ${asset.kind} asset ${asset.displayName} from ${existing.sourcePath} and ${asset.sourcePath}`
      )
    }
    seen.set(key, asset)
  }
}

const assertNoMcpConflicts = (
  assets: Array<Extract<WorkspaceAsset, { kind: 'mcpServer' }>>
) => {
  const seen = new Map<string, WorkspaceAsset>()
  for (const asset of assets) {
    const existing = seen.get(asset.displayName)
    if (existing != null) {
      throw new Error(`Duplicate MCP server ${asset.displayName} from ${existing.sourcePath} and ${asset.sourcePath}`)
    }
    seen.set(asset.displayName, asset)
  }
}

const syncSkillDependencyAssets = async (params: {
  cwd: string
  configs: [Config?, Config?]
  assets: WorkspaceAsset[]
}) => {
  const skillAssets = params.assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'skill' }> =>
    asset.kind === 'skill'
  )
  const processedSkillIds = new Set<string>()
  const fetchedDependencyRefs = new Set<string>()

  for (let index = 0; index < skillAssets.length; index++) {
    const asset = skillAssets[index]
    if (processedSkillIds.has(asset.id)) continue
    processedSkillIds.add(asset.id)

    for (const dependency of normalizeSkillDependencies(asset.payload.definition.attributes.dependencies)) {
      if (findSkillDependencyAsset(skillAssets, dependency, asset.instancePath) != null) continue
      if (fetchedDependencyRefs.has(dependency.ref)) continue
      fetchedDependencyRefs.add(dependency.ref)

      const installed = await installRegistrySkillDependency({
        cwd: params.cwd,
        configs: params.configs,
        dependency
      })
      const dependencyDefinition = await parseFrontmatterDocument(installed.skillPath)
      const dependencyAsset = createDocumentAsset({
        cwd: params.cwd,
        kind: 'skill',
        definition: dependencyDefinition,
        origin: 'workspace'
      })

      const existingAsset = findSkillDependencyAsset(skillAssets, dependency, asset.instancePath) ??
        skillAssets.find(existing => existing.displayName === dependencyAsset.displayName)
      if (existingAsset != null) continue

      params.assets.push(dependencyAsset)
      skillAssets.push(dependencyAsset)
    }
  }
}

export async function collectWorkspaceAssets(params: {
  cwd: string
  configs?: [Config?, Config?]
  plugins?: PluginConfig
  overlaySource?: string
  includeManagedPlugins?: boolean
  useDefaultVibeForgeMcpServer?: boolean
}): Promise<{
  assets: WorkspaceAsset[]
  defaultExcludeMcpServers: string[]
  defaultIncludeMcpServers: string[]
  entities: Array<Extract<WorkspaceAsset, { kind: 'entity' }>>
  hookPlugins: Extract<WorkspaceAsset, { kind: 'hookPlugin' }>[]
  mcpServers: Record<string, Extract<WorkspaceAsset, { kind: 'mcpServer' }>>
  opencodeOverlayAssets: Array<Extract<WorkspaceAsset, { kind: OpenCodeOverlayKind }>>
  pluginConfigs: PluginConfig | undefined
  pluginInstances: Awaited<ReturnType<typeof resolveConfiguredPluginInstances>>
  rules: Array<Extract<WorkspaceAsset, { kind: 'rule' }>>
  skills: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>
  specs: Array<Extract<WorkspaceAsset, { kind: 'spec' }>>
}> {
  const [config, userConfig] = params.configs ?? await loadWorkspaceConfig(params.cwd)
  const managedPluginConfigs = params.includeManagedPlugins === false
    ? undefined
    : toManagedPluginConfig(await listManagedPluginInstalls(params.cwd))
  const pluginConfigs = mergePluginConfigs(
    params.plugins ?? mergePluginConfigs(config?.plugins, userConfig?.plugins),
    managedPluginConfigs
  )
  const pluginInstances = await resolveConfiguredPluginInstances({
    cwd: params.cwd,
    plugins: pluginConfigs,
    overlaySource: params.overlaySource
  })

  const localScan = await scanWorkspaceDocuments(params.cwd)
  const flattenedPluginInstances = flattenPluginInstances(pluginInstances)
  const pluginScans = await Promise.all(flattenedPluginInstances.map(instance => scanInstanceDocuments(instance)))
  const pluginOverlayScans = await Promise.all(
    flattenedPluginInstances.map(instance => scanInstanceOpenCodeOverlays(instance))
  )

  const assets: WorkspaceAsset[] = []

  const pushDocumentAssets = async <TKind extends DocumentAssetKind>(
    kind: TKind,
    paths: string[],
    origin: 'workspace' | 'plugin',
    instance?: ResolvedPluginInstance,
    parser?: (path: string) => Promise<any>
  ) => {
    const definitions = await Promise.all(paths.map(path => (
      parser != null ? parser(path) : parseFrontmatterDocument(path)
    )))
    assets.push(
      ...definitions.map(definition =>
        createDocumentAsset({
          cwd: params.cwd,
          kind,
          definition,
          origin,
          scope: instance?.scope,
          instance
        })
      )
    )
  }

  await pushDocumentAssets('rule', localScan.rulePaths, 'workspace')
  await pushDocumentAssets('skill', localScan.skillPaths, 'workspace')
  await pushDocumentAssets('spec', localScan.specPaths, 'workspace')
  await pushDocumentAssets('entity', localScan.entityDocPaths, 'workspace')
  await pushDocumentAssets('entity', localScan.entityJsonPaths, 'workspace', undefined, parseEntityIndexJson)

  for (let index = 0; index < flattenedPluginInstances.length; index++) {
    const instance = flattenedPluginInstances[index]
    const scan = pluginScans[index]
    await pushDocumentAssets('rule', scan.rulePaths, 'plugin', instance)
    await pushDocumentAssets('skill', scan.skillPaths, 'plugin', instance)
    await pushDocumentAssets('spec', scan.specPaths, 'plugin', instance)
    await pushDocumentAssets('entity', scan.entityDocPaths, 'plugin', instance)
    await pushDocumentAssets('entity', scan.entityJsonPaths, 'plugin', instance, parseEntityIndexJson)
  }

  await syncSkillDependencyAssets({
    cwd: params.cwd,
    configs: [config, userConfig],
    assets
  })

  const mcpAssets = new Map<string, Extract<WorkspaceAsset, { kind: 'mcpServer' }>>()
  const addMcpAsset = (
    asset: Extract<WorkspaceAsset, { kind: 'mcpServer' }>,
    options?: { overwrite?: boolean }
  ) => {
    const existing = mcpAssets.get(asset.displayName)
    if (existing != null && options?.overwrite !== true) {
      throw new Error(`Duplicate MCP server ${asset.displayName} from ${existing.sourcePath} and ${asset.sourcePath}`)
    }
    mcpAssets.set(asset.displayName, asset)
  }

  if (params.useDefaultVibeForgeMcpServer !== false) {
    const defaultVibeForgeMcpServer = resolveDefaultVibeForgeMcpServerConfig()
    if (defaultVibeForgeMcpServer != null) {
      addMcpAsset(createMcpAsset({
        cwd: params.cwd,
        name: DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
        config: defaultVibeForgeMcpServer,
        origin: 'workspace',
        sourcePath: resolveProjectAiBaseDir(params.cwd, process.env)
      }))
    }
  }

  for (const [name, configValue] of Object.entries(config?.mcpServers ?? {})) {
    if (configValue.enabled === false) continue
    const { enabled: _enabled, ...nextConfig } = configValue
    addMcpAsset(
      createMcpAsset({
        cwd: params.cwd,
        name,
        config: nextConfig as NonNullable<Config['mcpServers']>[string],
        origin: 'workspace',
        sourcePath: resolve(params.cwd, '.ai.config.json')
      }),
      { overwrite: true }
    )
  }

  for (const [name, configValue] of Object.entries(userConfig?.mcpServers ?? {})) {
    if (configValue.enabled === false) continue
    const { enabled: _enabled, ...nextConfig } = configValue
    addMcpAsset(
      createMcpAsset({
        cwd: params.cwd,
        name,
        config: nextConfig as NonNullable<Config['mcpServers']>[string],
        origin: 'workspace',
        sourcePath: resolve(params.cwd, '.ai.dev.config.json')
      }),
      { overwrite: true }
    )
  }

  for (let index = 0; index < flattenedPluginInstances.length; index++) {
    const instance = flattenedPluginInstances[index]
    const scan = pluginScans[index]
    for (const path of scan.mcpPaths) {
      const parsed = await parseStructuredMcpFile(path)
      if (!isRecord(parsed)) continue
      const fileName = basename(path, extname(path))
      const name = typeof parsed.name === 'string' && parsed.name.trim() !== ''
        ? parsed.name.trim()
        : fileName
      const { name: _name, enabled, ...configValue } = parsed
      if (enabled === false) continue
      addMcpAsset(createMcpAsset({
        cwd: params.cwd,
        name,
        config: configValue as NonNullable<Config['mcpServers']>[string],
        origin: 'plugin',
        scope: instance.scope,
        sourcePath: path,
        instance
      }))
    }
  }

  const hookPlugins = flattenedPluginInstances
    .filter(instance => resolvePluginHooksEntryPathForInstance(params.cwd, instance) != null)
    .map(instance => createHookPluginAsset(instance))
  assets.push(...hookPlugins)

  const opencodeOverlayAssets = flattenedPluginInstances.flatMap((instance, index) => (
    pluginOverlayScans[index].map((entry) =>
      createOpenCodeOverlayAsset({
        cwd: params.cwd,
        kind: entry.kind,
        sourcePath: entry.sourcePath,
        entryName: entry.entryName,
        targetSubpath: entry.targetSubpath,
        instance
      })
    )
  ))
  assets.push(...opencodeOverlayAssets)

  assets.push(...mcpAssets.values())

  const rules = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'rule' }> => asset.kind === 'rule')
  const specs = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'spec' }> => asset.kind === 'spec')
  const entities = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'entity' }> =>
    asset.kind === 'entity'
  )
  const skills = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'skill' }> => asset.kind === 'skill')

  assertNoDocumentConflicts([...rules, ...specs, ...entities, ...skills])
  assertNoMcpConflicts(Array.from(mcpAssets.values()))

  return {
    assets,
    defaultExcludeMcpServers: [
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ],
    defaultIncludeMcpServers: [
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ],
    entities,
    hookPlugins,
    mcpServers: Object.fromEntries(Array.from(mcpAssets.values()).map(asset => [asset.displayName, asset])),
    opencodeOverlayAssets,
    pluginConfigs,
    pluginInstances,
    rules,
    skills,
    specs
  }
}
