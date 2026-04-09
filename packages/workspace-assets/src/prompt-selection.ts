import type {
  Definition,
  Filter,
  PluginOverlayConfig,
  Rule,
  RuleReference,
  SkillSelection,
  WorkspaceAsset,
  WorkspaceAssetBundle,
  WorkspaceMcpSelection,
  WorkspaceSkillSelection
} from '@vibe-forge/types'

import { resolveWorkspaceAssetBundle } from './bundle'
import {
  generateEntitiesRoutePrompt,
  generateRulesPrompt,
  generateSkillsPrompt,
  generateSkillsRoutePrompt,
  generateSpecRoutePrompt
} from './prompt-builders'
import {
  definitionWithResolvedName,
  pickDocumentAsset,
  resolveExcludedSkillRefs,
  resolveIncludedSkillRefs,
  resolveNamedAssets,
  resolvePluginOverlay,
  resolveRuleSelection,
  resolveSelectedSkillAssets,
  toDocumentDefinitions
} from './selection-internal'

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
      ? pickDocumentAsset(params.bundle.specs, params.name)
      : pickDocumentAsset(params.bundle.entities, params.name)
    if (baseTarget == null) {
      throw new Error(`Failed to load ${params.type} ${params.name}`)
    }

    const pluginOverlay = baseTarget.payload.definition.attributes.plugins as PluginOverlayConfig | undefined
    if (pluginOverlay != null) {
      effectiveBundle = await resolveWorkspaceAssetBundle({
        cwd: params.bundle.cwd,
        plugins: resolvePluginOverlay(params.bundle.pluginConfigs, pluginOverlay),
        overlaySource: `${params.type}:${baseTarget.displayName}`,
        includeManagedPlugins: pluginOverlay.mode !== 'override'
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
    ...selectedSkillAssets.map(asset => asset.id),
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
        ruleDefinitions.set(
          asset.id,
          definitionWithResolvedName(
            {
              ...asset.payload.definition,
              attributes: {
                ...asset.payload.definition.attributes,
                always: true
              }
            },
            asset.displayName,
            asset.instancePath
          )
        )
      }
      selection.remoteDefinitions.forEach((definition) => {
        ruleDefinitions.set(definition.path, definition)
      })
    }

    const skillSelection = attributes.skills as string[] | SkillSelection | undefined
    const includedRefs = resolveIncludedSkillRefs(skillSelection)
    const excludedRefs = resolveExcludedSkillRefs(skillSelection)
    const includedAssets = skillSelection == null
      ? []
      : includedRefs != null
      ? (includedRefs.length > 0 ? resolveNamedAssets(effectiveBundle.skills, includedRefs, targetInstancePath) : [])
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
  const routedSkills = toDocumentDefinitions(
    selectedSkillAssets.filter(skill => !targetSkillsAssets.some(target => target.id === skill.id))
  )
  const entities = params.type !== 'entity'
    ? toDocumentDefinitions(effectiveBundle.entities)
    : []
  const skills = toDocumentDefinitions(selectedSkillAssets)
  const specs = toDocumentDefinitions(effectiveBundle.specs)

  options.systemPrompt = [
    generateRulesPrompt(effectiveBundle.cwd, rules),
    generateSkillsPrompt(effectiveBundle.cwd, targetSkills),
    generateEntitiesRoutePrompt(entities),
    generateSkillsRoutePrompt(effectiveBundle.cwd, routedSkills),
    generateSpecRoutePrompt(specs, { active: params.type === 'spec' }),
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
