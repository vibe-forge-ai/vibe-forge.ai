import { basename, dirname } from 'node:path'

import { DefinitionLoader } from '@vibe-forge/definition-loader'
import type {
  Filter,
  PromptAssetResolution,
  ResolvedPromptAssetOptions,
  WorkspaceAsset,
  WorkspaceAssetBundle,
  WorkspaceSkillSelection
} from '@vibe-forge/types'

import {
  dedupeSkillAssets,
  filterSkillAssets,
  pickEntityAsset,
  pickSpecAsset,
  resolveExcludedSkillNames,
  resolveIncludedSkillNames,
  resolveRulePatterns,
  resolveSelectedRuleAssets,
  toDocumentDefinitions,
  toPromptAssetIds
} from './document-assets'

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
      const matchedRuleAssets = await resolveSelectedRuleAssets(params.bundle, resolveRulePatterns(attributes.rules))
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
      const includedSkillNames = new Set(resolveIncludedSkillNames(attributes.skills))
      const excludedSkillNames = new Set(resolveExcludedSkillNames(attributes.skills))
      for (const skillAsset of params.bundle.skills) {
        const skillName = basename(dirname(skillAsset.payload.definition.path))
        if (includedSkillNames.size > 0 && !includedSkillNames.has(skillName)) continue
        if (excludedSkillNames.has(skillName)) continue
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
