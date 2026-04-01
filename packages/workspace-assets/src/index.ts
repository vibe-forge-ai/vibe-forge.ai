import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import process from 'node:process'

import {
  buildConfigJsonVariables,
  DEFAULT_VIBE_FORGE_MCP_SERVER_NAME,
  loadConfig,
  resolveDefaultVibeForgeMcpServerConfig
} from '@vibe-forge/config'
import type {
  AdapterAssetPlan,
  AdapterOverlayEntry,
  AssetDiagnostic,
  Config,
  Definition,
  Entity,
  Filter,
  PluginConfig,
  PluginOverlayConfig,
  Rule,
  RuleReference,
  Skill,
  SkillSelection,
  Spec,
  WorkspaceAsset,
  WorkspaceAssetAdapter,
  WorkspaceAssetBundle,
  WorkspaceAssetKind,
  WorkspaceMcpSelection,
  WorkspaceSkillSelection
} from '@vibe-forge/types'
import {
  normalizePath,
  resolveDocumentName,
  resolvePromptPath,
  resolveRelativePath,
  resolveSpecIdentifier
} from '@vibe-forge/utils'
import {
  flattenPluginInstances,
  mergePluginConfigs,
  normalizePluginConfig,
  resolveConfiguredPluginInstances,
  type ResolvedPluginInstance
} from '@vibe-forge/utils/plugin-resolver'
import { glob } from 'fast-glob'
import fm from 'front-matter'
import yaml from 'js-yaml'

type DocumentAssetKind = Extract<WorkspaceAssetKind, 'rule' | 'spec' | 'entity' | 'skill'>
type OpenCodeOverlayKind = Extract<WorkspaceAssetKind, 'agent' | 'command' | 'mode' | 'nativePlugin'>
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

type OpenCodeOverlayAsset<TKind extends OpenCodeOverlayKind> = Extract<WorkspaceAsset, { kind: TKind }>

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const getFirstNonEmptyLine = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

const resolveDisplayName = (name: string, scope?: string) => (
  scope != null && scope.trim() !== '' ? `${scope}/${name}` : name
)

const resolveDocumentDescription = (
  body: string,
  explicitDescription?: string,
  fallbackName?: string
) => {
  const trimmedDescription = explicitDescription?.trim()
  return trimmedDescription || getFirstNonEmptyLine(body) || fallbackName || ''
}

const resolveDefinitionName = <T extends { name?: string }>(
  definition: Definition<T>,
  indexFileNames: string[] = []
) => definition.resolvedName?.trim() || resolveDocumentName(definition.path, definition.attributes.name, indexFileNames)

const resolveEntityIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['readme.md', 'index.json'])
)

const resolveSkillIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['skill.md'])
)

const parseScopedReference = (value: string) => {
  if (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    value.endsWith('.md') ||
    value.endsWith('.json') ||
    value.endsWith('.yaml') ||
    value.endsWith('.yml')
  ) {
    return undefined
  }
  const separatorIndex = value.indexOf('/')
  if (separatorIndex <= 0) return undefined
  return {
    scope: value.slice(0, separatorIndex),
    name: value.slice(separatorIndex + 1)
  }
}

const isPathLikeReference = (value: string) => (
  value.startsWith('./') ||
  value.startsWith('../') ||
  value.startsWith('/') ||
  value.includes('*') ||
  value.endsWith('.md') ||
  value.endsWith('.json') ||
  value.endsWith('.yaml') ||
  value.endsWith('.yml')
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
    id: `${params.kind}:${params.origin}:${params.instance?.instancePath ?? 'workspace'}:${displayName}:${resolveRelativePath(params.cwd, params.definition.path)}`,
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
    id: `mcpServer:${params.origin}:${params.instance?.instancePath ?? 'workspace'}:${displayName}:${resolveRelativePath(params.cwd, params.sourcePath)}`,
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
  id: `${params.kind}:plugin:${params.instance.instancePath}:${resolveDisplayName(params.entryName, params.instance.scope)}:${resolveRelativePath(params.cwd, params.sourcePath)}`,
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
  const [rulePaths, skillPaths, specPaths, entityDocPaths, entityJsonPaths, mcpPaths] = await Promise.all([
    glob(['.ai/rules/*.md'], { cwd, absolute: true }),
    glob(['.ai/skills/*/SKILL.md'], { cwd, absolute: true }),
    glob(['.ai/specs/*.md', '.ai/specs/*/index.md'], { cwd, absolute: true }),
    glob(['.ai/entities/*.md', '.ai/entities/*/README.md'], { cwd, absolute: true }),
    glob(['.ai/entities/*/index.json'], { cwd, absolute: true }),
    glob(['.ai/mcp/*.json', '.ai/mcp/*.yaml', '.ai/mcp/*.yml'], { cwd, absolute: true })
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
  const rootDir = instance.rootDir
  const assets = instance.manifest?.assets
  const resolveAssetRoot = (dir: string | undefined, fallback: string) => resolve(rootDir, dir ?? fallback)

  const [rulePaths, skillPaths, specPaths, entityDocPaths, entityJsonPaths, mcpPaths] = await Promise.all([
    glob(['*.md'], { cwd: resolveAssetRoot(assets?.rules, 'rules'), absolute: true }).catch(() => [] as string[]),
    glob(['*/SKILL.md'], { cwd: resolveAssetRoot(assets?.skills, 'skills'), absolute: true }).catch(() => [] as string[]),
    glob(['*.md', '*/index.md'], { cwd: resolveAssetRoot(assets?.specs, 'specs'), absolute: true }).catch(() => [] as string[]),
    glob(['*.md', '*/README.md'], { cwd: resolveAssetRoot(assets?.entities, 'entities'), absolute: true }).catch(() => [] as string[]),
    glob(['*/index.json'], { cwd: resolveAssetRoot(assets?.entities, 'entities'), absolute: true }).catch(() => [] as string[]),
    glob(['*.json', '*.yaml', '*.yml'], { cwd: resolveAssetRoot(assets?.mcp, 'mcp'), absolute: true }).catch(() => [] as string[])
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
): OpenCodeOverlayAssetEntry[] => paths.map((sourcePath) => ({
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
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'agents'), absolute: true, onlyFiles: true }).catch(() => [] as string[]),
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'commands'), absolute: true, onlyFiles: true }).catch(() => [] as string[]),
    glob(['*.md'], { cwd: resolve(opencodeRoot, 'modes'), absolute: true, onlyFiles: true }).catch(() => [] as string[]),
    glob(['**/*'], { cwd: resolve(opencodeRoot, 'plugins'), absolute: true, onlyFiles: true }).catch(() => [] as string[])
  ])

  return [
    ...toOpenCodeOverlayEntries('agent', 'agents', agentPaths),
    ...toOpenCodeOverlayEntries('command', 'commands', commandPaths),
    ...toOpenCodeOverlayEntries('mode', 'modes', modePaths),
    ...toOpenCodeOverlayEntries('nativePlugin', 'plugins', nativePluginPaths)
  ]
}

const definitionWithResolvedName = <TDefinition>(
  definition: Definition<TDefinition>,
  resolvedName: string,
  instancePath?: string
) => ({
  ...definition,
  resolvedName,
  resolvedInstancePath: instancePath
})

const toDocumentDefinitions = <TDefinition>(
  assets: Array<DocumentAsset<TDefinition>>
) => assets.map(asset => definitionWithResolvedName(
  asset.payload.definition,
  asset.displayName,
  asset.instancePath
))

const assertNoDocumentConflicts = (
  assets: Array<Extract<WorkspaceAsset, { kind: 'rule' | 'spec' | 'entity' | 'skill' }>>
) => {
  const seen = new Map<string, WorkspaceAsset>()
  for (const asset of assets) {
    const key = `${asset.kind}:${asset.displayName}`
    const existing = seen.get(key)
    if (existing != null) {
      throw new Error(`Duplicate ${asset.kind} asset ${asset.displayName} from ${existing.sourcePath} and ${asset.sourcePath}`)
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

const resolveUniqueAssetByName = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  name: string
) => {
  const matches = assets.filter(asset => asset.name === name)
  if (matches.length === 0) return undefined
  const unscopedMatches = matches.filter(asset => asset.scope == null)
  if (unscopedMatches.length === 1) {
    return unscopedMatches[0]
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous asset reference ${name}. Candidates: ${matches.map(match => match.displayName).join(', ')}`)
  }
  return matches[0]
}

const resolveScopedAsset = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  scope: string,
  name: string
) => assets.find(asset => asset.scope === scope && asset.name === name)

const resolveNamedAssets = <TAsset extends Extract<WorkspaceAsset, { kind: DocumentAssetKind }>>(
  assets: TAsset[],
  refs: string[] | undefined,
  currentInstancePath?: string
) => {
  if (refs == null || refs.length === 0) return [] as TAsset[]

  const selected: TAsset[] = []
  const seen = new Set<string>()

  const add = (asset: TAsset) => {
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    selected.push(asset)
  }

  for (const ref of refs) {
    const scoped = parseScopedReference(ref)
    if (scoped != null) {
      const asset = resolveScopedAsset(assets, scoped.scope, scoped.name)
      if (asset == null) throw new Error(`Failed to resolve asset ${ref}`)
      add(asset)
      continue
    }

    if (currentInstancePath != null) {
      const local = assets.find(asset => asset.instancePath === currentInstancePath && asset.name === ref)
      if (local != null) {
        add(local)
        continue
      }
    }

    const asset = resolveUniqueAssetByName(assets, ref)
    if (asset == null) throw new Error(`Failed to resolve asset ${ref}`)
    add(asset)
  }

  return selected
}

const toRuleSelectionRefs = (
  refs: RuleReference[] | string[] | undefined
) => (refs ?? []).flatMap((ref) => {
  if (typeof ref === 'string') return [ref]
  if (ref.type === 'remote') return []
  return [ref.path]
})

const createRemoteRuleDefinition = (
  rule: Extract<RuleReference, { type: 'remote' }>,
  index: number
): Definition<Rule> => {
  const tags = Array.isArray(rule.tags)
    ? rule.tags.filter((value): value is string => typeof value === 'string' && value.trim() !== '').map(value => value.trim())
    : []
  const description = rule.desc?.trim() || (
    tags.length > 0
      ? `远程知识库标签：${tags.join(', ')}`
      : '远程知识库规则引用'
  )

  return {
    path: `remote-rule-${index + 1}.md`,
    body: [
      description,
      tags.length > 0 ? `知识库标签：${tags.join(', ')}` : undefined,
      '该规则来自远程知识库引用，不对应本地文件。'
    ].filter((value): value is string => value != null && value !== '').join('\n'),
    attributes: {
      name: tags.length > 0 ? `remote:${tags.join(',')}` : `remote-rule-${index + 1}`,
      description
    }
  }
}

const resolvePathMatchedRules = async (
  bundle: WorkspaceAssetBundle,
  ref: string
) => {
  const matchedPaths = new Set(
    (await glob(ref, {
      cwd: bundle.cwd,
      absolute: true
    })).map(normalizePath)
  )
  return bundle.rules.filter(rule => matchedPaths.has(normalizePath(rule.sourcePath)))
}

const resolveRuleSelection = async (
  bundle: WorkspaceAssetBundle,
  refs: RuleReference[] | string[] | undefined,
  currentInstancePath?: string
) => {
  const assets: Array<Extract<WorkspaceAsset, { kind: 'rule' }>> = []
  const remoteDefinitions: Definition<Rule>[] = []
  const seen = new Set<string>()

  const addAsset = (asset: Extract<WorkspaceAsset, { kind: 'rule' }>) => {
    if (seen.has(asset.id)) return
    seen.add(asset.id)
    assets.push(asset)
  }

  let remoteIndex = 0
  for (const ref of refs ?? []) {
    if (typeof ref === 'object' && ref != null && ref.type === 'remote') {
      remoteDefinitions.push(createRemoteRuleDefinition(ref, remoteIndex++))
      continue
    }

    const value = typeof ref === 'string' ? ref : ref.path
    if (isPathLikeReference(value)) {
      const matched = await resolvePathMatchedRules(bundle, value)
      matched.forEach(addAsset)
      continue
    }

    const scoped = parseScopedReference(value)
    if (scoped != null) {
      const asset = resolveScopedAsset(bundle.rules, scoped.scope, scoped.name)
      if (asset == null) throw new Error(`Failed to resolve rule ${value}`)
      addAsset(asset)
      continue
    }

    if (currentInstancePath != null) {
      const local = bundle.rules.find(rule => rule.instancePath === currentInstancePath && rule.name === value)
      if (local != null) {
        addAsset(local)
        continue
      }
    }

    const asset = resolveUniqueAssetByName(bundle.rules, value)
    if (asset == null) throw new Error(`Failed to resolve rule ${value}`)
    addAsset(asset)
  }

  return {
    assets,
    remoteDefinitions
  }
}

const resolveIncludedSkillRefs = (selection: string[] | SkillSelection | undefined) => {
  if (selection == null) return undefined
  if (Array.isArray(selection)) return selection
  return selection.type === 'include' ? selection.list : undefined
}

const resolveExcludedSkillRefs = (selection: string[] | SkillSelection | undefined) => {
  if (selection == null || Array.isArray(selection)) return undefined
  return selection.type === 'exclude' ? selection.list : undefined
}

const resolveSelectedSkillAssets = (
  assets: Array<Extract<WorkspaceAsset, { kind: 'skill' }>>,
  selection?: WorkspaceSkillSelection
) => {
  if (selection == null) return assets

  const included = selection.include != null && selection.include.length > 0
    ? resolveNamedAssets(assets, selection.include)
    : assets
  const excluded = new Set(
    resolveNamedAssets(assets, selection.exclude).map(asset => asset.id)
  )
  return included.filter(asset => !excluded.has(asset.id))
}

const resolveSelectedMcpNames = (
  bundle: WorkspaceAssetBundle,
  selection: WorkspaceMcpSelection | undefined
) => {
  const allAssets = Object.values(bundle.mcpServers)
  const includeRefs = selection?.include ?? (bundle.defaultIncludeMcpServers.length > 0 ? bundle.defaultIncludeMcpServers : undefined)
  const excludeRefs = selection?.exclude ?? (bundle.defaultExcludeMcpServers.length > 0 ? bundle.defaultExcludeMcpServers : undefined)

  const resolveRefs = (refs: string[] | undefined) => {
    if (refs == null || refs.length === 0) return undefined
    return new Set(refs.map((ref) => {
      const scoped = parseScopedReference(ref)
      if (scoped != null) {
        const asset = allAssets.find(item => item.scope === scoped.scope && item.name === scoped.name)
        if (asset == null) throw new Error(`Failed to resolve MCP server ${ref}`)
        return asset.displayName
      }

      const matches = allAssets.filter(item => item.name === ref || item.displayName === ref)
      if (matches.length === 0) throw new Error(`Failed to resolve MCP server ${ref}`)
      if (matches.length > 1) {
        throw new Error(`Ambiguous MCP server reference ${ref}. Candidates: ${matches.map(match => match.displayName).join(', ')}`)
      }
      return matches[0].displayName
    }))
  }

  const include = resolveRefs(includeRefs)
  const exclude = resolveRefs(excludeRefs) ?? new Set<string>()

  return allAssets
    .map(asset => asset.displayName)
    .filter(name => (include == null || include.has(name)) && !exclude.has(name))
}

const resolvePluginOverlay = (
  basePlugins: PluginConfig | undefined,
  overlay: PluginOverlayConfig | undefined
) => {
  if (overlay == null) return basePlugins
  if (overlay.mode !== 'override' && overlay.mode !== 'extend') {
    throw new Error('Invalid plugins overlay. "mode" must be "extend" or "override".')
  }

  const overlayList = normalizePluginConfig(overlay.list, 'plugins overlay list') ?? []
  return overlay.mode === 'override'
    ? overlayList
    : [
      ...(basePlugins ?? []),
      ...overlayList
    ]
}

const generateRulesPrompt = (rules: Definition<Rule>[]) => {
  const rulesPrompt = rules
    .map((rule) => {
      const name = resolveDefinitionName(rule)
      const desc = resolveDocumentDescription(rule.body, rule.attributes.description, name)
      const content = rule.attributes.always && rule.body.trim()
        ? `<rule-content>\n${rule.body.trim()}\n</rule-content>\n`
        : ''
      return `  - ${name}：${desc}\n${content}--------------------\n`
    })
    .filter(Boolean)
    .join('\n')

  return `<system-prompt>\n项目系统规则如下：\n${rulesPrompt}\n</system-prompt>\n`
}

const generateSkillsPrompt = (cwd: string, skills: Definition<Skill>[]) => (
  skills
    .map((skill) => {
      const name = resolveDefinitionName(skill, ['skill.md'])
      const desc = resolveDocumentDescription(skill.body, skill.attributes.description, name)
      return [
        '技能相关信息如下，通过阅读以下内容了解技能的详细信息：',
        `- 技能名称：${name}`,
        `- 技能介绍：${desc}`,
        `- 技能文件资源路径：${resolvePromptPath(cwd, dirname(skill.path))}`,
        '- 资源内容：',
        '<skill-content>',
        skill.body.trim(),
        '</skill-content>',
        '资源内容中的文件路径相对「技能文件资源路径」路径，通过读取相关工具按照实际需要进行阅读。'
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n')
)

const generateSkillsRoutePrompt = (skills: Definition<Skill>[]) => (
  '<skills>\n' +
  `${
    skills
      .filter(({ attributes: { always } }) => always !== false)
      .map((skill) => {
        const name = resolveDefinitionName(skill, ['skill.md'])
        const desc = resolveDocumentDescription(skill.body, skill.attributes.description, name)
        return `  - ${name}：${desc}\n`
      })
      .join('')
  }\n` +
  '</skills>\n'
)

const generateSpecRoutePrompt = (specs: Definition<Spec>[]) => {
  const specsRouteStr = specs
    .filter(({ attributes }) => attributes.always !== false)
    .map((spec) => {
      const name = resolveDefinitionName(spec, ['index.md'])
      const desc = resolveDocumentDescription(spec.body, spec.attributes.description, name)
      const identifier = spec.resolvedName?.trim() || resolveSpecIdentifier(spec.path, spec.attributes.name)
      const params = spec.attributes.params ?? []
      const paramsPrompt = params.length > 0
        ? params.map(({ name: paramName, description }) => `    - ${paramName}：${description ?? '无'}\n`).join('')
        : '    - 无\n'

      return (
        `- 流程名称：${name}\n` +
        `  - 介绍：${desc}\n` +
        `  - 标识：${identifier}\n` +
        '  - 参数：\n' +
        `${paramsPrompt}`
      )
    })
    .join('\n')

  return (
    '<system-prompt>\n' +
    '你是一个专业的项目推进管理大师，能够熟练指导其他实体来为你的目标工作。对你的预期是：\n' +
    '\n' +
    '- 永远不要单独完成代码开发工作\n' +
    '- 必须要协调其他的开发人员来完成任务\n' +
    '- 必须让他们按照目标进行完成，不要偏离目标，检查他们任务完成后的汇报内容是否符合要求\n' +
    '\n' +
    '根据用户需要以及实际的开发目标来决定使用不同的工作流程，调用 `load-spec` mcp tool 完成工作流程的加载。\n' +
    '- 根据实际需求传入标识，这不是路径，只能使用工具进行加载\n' +
    '- 通过参数的描述以及实际应用场景决定怎么传入参数\n' +
    '项目存在如下工作流程：\n' +
    `${specsRouteStr}\n` +
    '</system-prompt>\n'
  )
}

const generateEntitiesRoutePrompt = (entities: Definition<Entity>[]) => (
  '<system-prompt>\n' +
  '项目存在如下实体：\n' +
  `${
    entities
      .filter(({ attributes }) => attributes.always !== false)
      .map((entity) => {
        const name = resolveDefinitionName(entity, ['readme.md', 'index.json'])
        const desc = resolveDocumentDescription(entity.body, entity.attributes.description, name)
        return `  - ${name}：${desc}\n`
      })
      .join('')
  }\n` +
  '解决用户问题时，需根据用户需求可以通过 run-tasks 工具指定为实体后，自行调度多个不同类型的实体来完成工作。\n' +
  '</system-prompt>\n'
)

const pickSpecAsset = (bundle: WorkspaceAssetBundle, ref: string) => {
  const scoped = parseScopedReference(ref)
  if (scoped != null) {
    return resolveScopedAsset(bundle.specs, scoped.scope, scoped.name)
  }
  return resolveUniqueAssetByName(bundle.specs, ref)
}

const pickEntityAsset = (bundle: WorkspaceAssetBundle, ref: string) => {
  const scoped = parseScopedReference(ref)
  if (scoped != null) {
    return resolveScopedAsset(bundle.entities, scoped.scope, scoped.name)
  }
  return resolveUniqueAssetByName(bundle.entities, ref)
}

export async function resolveWorkspaceAssetBundle(params: {
  cwd: string
  configs?: [Config?, Config?]
  plugins?: PluginConfig
  overlaySource?: string
  useDefaultVibeForgeMcpServer?: boolean
}): Promise<WorkspaceAssetBundle> {
  const [config, userConfig] = params.configs ?? await loadWorkspaceConfig(params.cwd)
  const pluginConfigs = params.plugins ?? mergePluginConfigs(config?.plugins, userConfig?.plugins)
  const pluginInstances = await resolveConfiguredPluginInstances({
    cwd: params.cwd,
    plugins: pluginConfigs,
    overlaySource: params.overlaySource
  })

  const localScan = await scanWorkspaceDocuments(params.cwd)
  const flattenedPluginInstances = flattenPluginInstances(pluginInstances)
  const pluginScans = await Promise.all(flattenedPluginInstances.map(instance => scanInstanceDocuments(instance)))
  const pluginOverlayScans = await Promise.all(flattenedPluginInstances.map(instance => scanInstanceOpenCodeOverlays(instance)))

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
      ...definitions.map(definition => createDocumentAsset({
        cwd: params.cwd,
        kind,
        definition,
        origin,
        scope: instance?.scope,
        instance
      }))
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
        sourcePath: resolve(params.cwd, '.ai')
      }))
    }
  }

  for (const [name, configValue] of Object.entries(config?.mcpServers ?? {})) {
    if (configValue.enabled === false) continue
    const { enabled: _enabled, ...nextConfig } = configValue
    addMcpAsset(createMcpAsset({
      cwd: params.cwd,
      name,
      config: nextConfig as NonNullable<Config['mcpServers']>[string],
      origin: 'workspace',
      sourcePath: resolve(params.cwd, '.ai.config.json')
    }), { overwrite: true })
  }

  for (const [name, configValue] of Object.entries(userConfig?.mcpServers ?? {})) {
    if (configValue.enabled === false) continue
    const { enabled: _enabled, ...nextConfig } = configValue
    addMcpAsset(createMcpAsset({
      cwd: params.cwd,
      name,
      config: nextConfig as NonNullable<Config['mcpServers']>[string],
      origin: 'workspace',
      sourcePath: resolve(params.cwd, '.ai.dev.config.json')
    }), { overwrite: true })
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
    .filter(instance => instance.packageId != null)
    .map(instance => createHookPluginAsset(instance))
  assets.push(...hookPlugins)

  const opencodeOverlayAssets = flattenedPluginInstances.flatMap((instance, index) => (
    pluginOverlayScans[index].map((entry) => createOpenCodeOverlayAsset({
      cwd: params.cwd,
      kind: entry.kind,
      sourcePath: entry.sourcePath,
      entryName: entry.entryName,
      targetSubpath: entry.targetSubpath,
      instance
    }))
  ))
  assets.push(...opencodeOverlayAssets)

  assets.push(...mcpAssets.values())

  const rules = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'rule' }> => asset.kind === 'rule')
  const specs = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'spec' }> => asset.kind === 'spec')
  const entities = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'entity' }> => asset.kind === 'entity')
  const skills = assets.filter((asset): asset is Extract<WorkspaceAsset, { kind: 'skill' }> => asset.kind === 'skill')

  assertNoDocumentConflicts([...rules, ...specs, ...entities, ...skills])
  assertNoMcpConflicts(Array.from(mcpAssets.values()))

  return {
    cwd: params.cwd,
    pluginConfigs,
    pluginInstances,
    assets,
    rules,
    specs,
    entities,
    skills,
    mcpServers: Object.fromEntries(Array.from(mcpAssets.values()).map(asset => [asset.displayName, asset])),
    hookPlugins,
    opencodeOverlayAssets,
    defaultIncludeMcpServers: [
      ...(config?.defaultIncludeMcpServers ?? []),
      ...(userConfig?.defaultIncludeMcpServers ?? [])
    ],
    defaultExcludeMcpServers: [
      ...(config?.defaultExcludeMcpServers ?? []),
      ...(userConfig?.defaultExcludeMcpServers ?? [])
    ]
  }
}

export async function resolvePromptAssetSelection(params: {
  bundle: WorkspaceAssetBundle
  type: 'spec' | 'entity' | undefined
  name?: string
  input?: {
    skills?: WorkspaceSkillSelection
  }
}) {
  const options: {
    systemPrompt?: string
    tools?: Filter
    mcpServers?: WorkspaceMcpSelection
    promptAssetIds?: string[]
    assetBundle?: WorkspaceAssetBundle
  } = {
    assetBundle: params.bundle
  }

  let effectiveBundle = params.bundle
  let pinnedTargetAsset: Extract<WorkspaceAsset, { kind: 'spec' | 'entity' }> | undefined
  let targetBody = ''
  let targetToolsFilter: Filter | undefined
  let targetMcpServersFilter: Filter | undefined
  let targetInstancePath: string | undefined

  if (params.type && params.name) {
    const baseTarget = params.type === 'spec'
      ? pickSpecAsset(params.bundle, params.name)
      : pickEntityAsset(params.bundle, params.name)
    if (baseTarget == null) {
      throw new Error(`Failed to load ${params.type} ${params.name}`)
    }

    const pluginOverlay = baseTarget.payload.definition.attributes.plugins as PluginOverlayConfig | undefined
    if (pluginOverlay != null) {
      effectiveBundle = await resolveWorkspaceAssetBundle({
        cwd: params.bundle.cwd,
        plugins: resolvePluginOverlay(params.bundle.pluginConfigs, pluginOverlay),
        overlaySource: `${params.type}:${baseTarget.displayName}`
      })
    }

    pinnedTargetAsset = baseTarget
    targetBody = baseTarget.payload.definition.body
    targetToolsFilter = baseTarget.payload.definition.attributes.tools
    targetMcpServersFilter = baseTarget.payload.definition.attributes.mcpServers
    targetInstancePath = baseTarget.instancePath
    options.assetBundle = effectiveBundle
  }

  const selectedSkillAssets = resolveSelectedSkillAssets(effectiveBundle.skills, params.input?.skills)
  const promptAssetIds = new Set<string>([
    ...effectiveBundle.rules.map(asset => asset.id),
    ...effectiveBundle.specs.map(asset => asset.id),
    ...effectiveBundle.skills.map(asset => asset.id),
    ...(params.type !== 'entity' ? effectiveBundle.entities.map(asset => asset.id) : [])
  ])
  const ruleDefinitions = new Map<string, Definition<Rule>>(
    effectiveBundle.rules.map(asset => [
      asset.id,
      definitionWithResolvedName(asset.payload.definition, asset.displayName, asset.instancePath)
    ])
  )
  const targetSkillsAssets: Array<Extract<WorkspaceAsset, { kind: 'skill' }>> = []

  if (pinnedTargetAsset != null) {
    promptAssetIds.add(pinnedTargetAsset.id)
    const attributes = pinnedTargetAsset.payload.definition.attributes

    if (attributes.rules != null) {
      const selection = await resolveRuleSelection(
        effectiveBundle,
        attributes.rules as RuleReference[] | string[],
        targetInstancePath
      )
      for (const asset of selection.assets) {
        promptAssetIds.add(asset.id)
        ruleDefinitions.set(asset.id, definitionWithResolvedName({
          ...asset.payload.definition,
          attributes: {
            ...asset.payload.definition.attributes,
            always: true
          }
        }, asset.displayName, asset.instancePath))
      }
      selection.remoteDefinitions.forEach((definition) => {
        ruleDefinitions.set(definition.path, definition)
      })
    }

    const includedRefs = resolveIncludedSkillRefs(attributes.skills as string[] | SkillSelection | undefined)
    const excludedRefs = resolveExcludedSkillRefs(attributes.skills as string[] | SkillSelection | undefined)
    const includedAssets = includedRefs != null && includedRefs.length > 0
      ? resolveNamedAssets(effectiveBundle.skills, includedRefs, targetInstancePath)
      : effectiveBundle.skills
    const excludedIds = new Set(
      resolveNamedAssets(effectiveBundle.skills, excludedRefs, targetInstancePath).map(asset => asset.id)
    )

    includedAssets
      .filter(asset => !excludedIds.has(asset.id))
      .forEach((asset) => {
        targetSkillsAssets.push(asset)
        promptAssetIds.add(asset.id)
      })
  }

  const rules = Array.from(ruleDefinitions.values())
  const targetSkills = toDocumentDefinitions(targetSkillsAssets)
  const selectedSkillsPrompt = toDocumentDefinitions(
    selectedSkillAssets.filter(skill => !targetSkillsAssets.some(target => target.id === skill.id))
  )
  const entities = params.type !== 'entity'
    ? toDocumentDefinitions(effectiveBundle.entities)
    : []
  const skills = toDocumentDefinitions(selectedSkillAssets)
  const specs = toDocumentDefinitions(effectiveBundle.specs)

  options.systemPrompt = [
    generateRulesPrompt(rules),
    generateSkillsPrompt(effectiveBundle.cwd, targetSkills),
    generateSkillsPrompt(effectiveBundle.cwd, selectedSkillsPrompt),
    generateEntitiesRoutePrompt(entities),
    generateSkillsRoutePrompt(toDocumentDefinitions(selectedSkillAssets)),
    generateSpecRoutePrompt(specs),
    targetBody
  ].join('\n\n')

  if (targetToolsFilter != null) {
    options.tools = targetToolsFilter
  }
  if (targetMcpServersFilter != null) {
    options.mcpServers = targetMcpServersFilter
  }
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
  ] as const
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
