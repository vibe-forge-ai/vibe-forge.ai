import { relative } from 'node:path'
import process from 'node:process'

import type { Definition, Entity, Rule, RuleReference, Skill, Spec } from '@vibe-forge/types'
import { resolveDocumentName, resolveSpecIdentifier } from '@vibe-forge/utils'
import { resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

import { glob } from 'fast-glob'

import {
  createRemoteRuleDefinition,
  isLocalRuleReference,
  isRemoteRuleReference,
  loadLocalDocuments,
  resolveEntityIdentifier,
  resolveRulePattern,
  resolveUniqueDefinition
} from './definition-utils'
import {
  generateEntitiesRoutePrompt,
  generateRulesPrompt,
  generateSkillsPrompt,
  generateSkillsRoutePrompt,
  generateSpecRoutePrompt
} from './prompt-builders'

export {
  isAlwaysRule,
  loadLocalDocuments,
  resolveDefinitionName,
  resolveDocumentDescription,
  resolveEntityIdentifier
} from './definition-utils'

interface WorkspaceDefinitionAsset<TDefinition extends { name?: string }> {
  payload: {
    definition: Definition<TDefinition>
  }
  displayName: string
  instancePath?: string
}

const toResolvedDefinitions = <TDefinition extends { name?: string }>(
  assets: WorkspaceDefinitionAsset<TDefinition>[]
): Definition<TDefinition>[] => (
  assets.map(asset => ({
    ...asset.payload.definition,
    resolvedName: asset.displayName,
    resolvedInstancePath: asset.instancePath
  }))
)

export class DefinitionLoader {
  private readonly cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
  }

  private async scan(
    patterns: string[],
    cwd: string = this.cwd
  ): Promise<string[]> {
    const paths = await glob(patterns, { cwd, absolute: true })
    return paths.sort((a, b) => {
      const aKey = relative(cwd, a).split('\\').join('/')
      const bKey = relative(cwd, b).split('\\').join('/')
      return aKey.localeCompare(bKey)
    })
  }

  async loadRules(
    rules: RuleReference[],
    options?: {
      baseDir?: string
    }
  ) {
    const baseDir = options?.baseDir ?? this.cwd
    const definitions: Definition<Rule>[] = []

    for (const [index, rule] of rules.entries()) {
      if (typeof rule === 'string') {
        const pattern = resolveRulePattern(rule, baseDir)
        if (!pattern) continue
        definitions.push(
          ...await loadLocalDocuments<Rule>(
            await this.scan([pattern])
          )
        )
        continue
      }

      if (isRemoteRuleReference(rule)) {
        definitions.push(createRemoteRuleDefinition(rule, index))
        continue
      }

      if (!isLocalRuleReference(rule)) continue

      const pattern = resolveRulePattern(rule.path, baseDir)
      if (!pattern) continue

      const docs = await loadLocalDocuments<Rule>(
        await this.scan([pattern])
      )

      definitions.push(
        ...docs.map((doc) => ({
          ...doc,
          attributes: {
            ...doc.attributes,
            description: rule.desc?.trim() || doc.attributes.description
          }
        }))
      )
    }

    return definitions
  }

  private async loadWorkspaceDefinitions<TDefinition extends { name?: string }>(
    select: (bundle: Awaited<ReturnType<typeof resolveWorkspaceAssetBundle>>) => WorkspaceDefinitionAsset<TDefinition>[]
  ): Promise<Definition<TDefinition>[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    return toResolvedDefinitions(select(bundle))
  }

  private async loadNamedWorkspaceDefinition<TDefinition extends { name?: string }>(
    ref: string,
    select: (
      bundle: Awaited<ReturnType<typeof resolveWorkspaceAssetBundle>>
    ) => WorkspaceDefinitionAsset<TDefinition>[],
    resolveIdentifier: (definition: Definition<TDefinition>) => string
  ): Promise<Definition<TDefinition> | undefined> {
    const definitions = await this.loadWorkspaceDefinitions(select)
    return resolveUniqueDefinition(definitions, ref, resolveIdentifier)
  }

  async loadDefaultRules(): Promise<Definition<Rule>[]> {
    return this.loadWorkspaceDefinitions(bundle => bundle.rules)
  }

  generateRulesPrompt(rules: Definition<Rule>[]): string {
    return generateRulesPrompt(this.cwd, rules)
  }

  async loadSkills(skills?: string[]): Promise<Definition<Skill>[]> {
    const allSkills = await this.loadWorkspaceDefinitions(bundle => bundle.skills)
    if (skills == null) return allSkills

    return skills
      .map(skillRef =>
        resolveUniqueDefinition(
          allSkills,
          skillRef,
          skill => resolveDocumentName(skill.path, skill.attributes.name, ['skill.md'])
        )
      )
      .filter((skill): skill is Definition<Skill> => skill != null)
  }

  async loadDefaultSkills(): Promise<Definition<Skill>[]> {
    return this.loadSkills()
  }

  generateSkillsPrompt(skills: Definition<Skill>[]): string {
    return generateSkillsPrompt(this.cwd, skills)
  }

  generateSkillsRoutePrompt(skills: Definition<Skill>[]): string {
    return generateSkillsRoutePrompt(this.cwd, skills)
  }

  async loadSpec(name: string): Promise<Definition<Spec> | undefined> {
    return this.loadNamedWorkspaceDefinition(
      name,
      bundle => bundle.specs,
      spec => resolveSpecIdentifier(spec.path, spec.attributes.name)
    )
  }

  async loadDefaultSpecs(): Promise<Definition<Spec>[]> {
    return this.loadWorkspaceDefinitions(bundle => bundle.specs)
  }

  generateSpecRoutePrompt(specsDocuments: Definition<Spec>[], options?: { active?: boolean }): string {
    return generateSpecRoutePrompt(specsDocuments, options)
  }

  async loadEntity(name: string): Promise<Definition<Entity> | undefined> {
    return this.loadNamedWorkspaceDefinition(
      name,
      bundle => bundle.entities,
      entity => resolveEntityIdentifier(entity.path, entity.attributes.name)
    )
  }

  async loadDefaultEntities(): Promise<Definition<Entity>[]> {
    return this.loadWorkspaceDefinitions(bundle => bundle.entities)
  }

  generateEntitiesRoutePrompt(entities: Definition<Entity>[]): string {
    return generateEntitiesRoutePrompt(entities)
  }
}
