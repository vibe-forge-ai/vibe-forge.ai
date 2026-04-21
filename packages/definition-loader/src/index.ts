import { relative } from 'node:path'
import process from 'node:process'

import {
  createRemoteRuleDefinition,
  isLocalRuleReference,
  isRemoteRuleReference,
  resolveEntityIdentifier,
  resolveSkillIdentifier,
  resolveSpecIdentifier
} from '@vibe-forge/definition-core'
import type {
  Definition,
  DefinitionSource,
  Entity,
  Rule,
  RuleReference,
  Skill,
  Spec,
  WorkspaceDefinitionPayload
} from '@vibe-forge/types'
import { resolveWorkspaceAssetBundle, resolveWorkspaceAssetSource } from '@vibe-forge/workspace-assets'

import { glob } from 'fast-glob'

import { loadLocalDocuments, resolveRulePattern, resolveUniqueDefinition } from './definition-utils'

interface WorkspaceDefinitionAsset<TDefinition extends { name?: string }> {
  payload: {
    definition: Definition<TDefinition>
  }
  displayName: string
  instancePath?: string
  origin: 'workspace' | 'plugin'
  resolvedBy?: string
}

const resolveDefinitionSource = (asset: Pick<WorkspaceDefinitionAsset<{ name?: string }>, 'origin' | 'resolvedBy'>): DefinitionSource => {
  return resolveWorkspaceAssetSource(asset)
}

const toResolvedDefinitions = <TDefinition extends { name?: string }>(
  assets: WorkspaceDefinitionAsset<TDefinition>[]
): Definition<TDefinition>[] => (
  assets.map(asset => ({
    ...asset.payload.definition,
    resolvedName: asset.displayName,
    resolvedInstancePath: asset.instancePath,
    resolvedSource: resolveDefinitionSource(asset)
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

  private async loadMatchedDocuments<TDefinition extends object>(
    pattern: string
  ): Promise<Definition<TDefinition>[]> {
    return loadLocalDocuments<TDefinition>(await this.scan([pattern]))
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
        definitions.push(...await this.loadMatchedDocuments<Rule>(pattern))
        continue
      }

      if (isRemoteRuleReference(rule)) {
        definitions.push(createRemoteRuleDefinition(rule, index))
        continue
      }

      if (!isLocalRuleReference(rule)) continue

      const pattern = resolveRulePattern(rule.path, baseDir)
      if (!pattern) continue

      const docs = await this.loadMatchedDocuments<Rule>(pattern)

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

  async loadSkills(skills?: string[]): Promise<Definition<Skill>[]> {
    const allSkills = await this.loadWorkspaceDefinitions(bundle => bundle.skills)
    if (skills == null) return allSkills

    return skills
      .map(skillRef =>
        resolveUniqueDefinition(
          allSkills,
          skillRef,
          skill => resolveSkillIdentifier(skill.path, skill.attributes.name)
        )
      )
      .filter((skill): skill is Definition<Skill> => skill != null)
  }

  async loadDefaultSkills(): Promise<Definition<Skill>[]> {
    return this.loadSkills()
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

  async loadWorkspaces(): Promise<WorkspaceDefinitionPayload[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    const workspaces = Array.isArray(bundle.workspaces) ? bundle.workspaces : []
    return workspaces.map(workspace => workspace.payload)
  }
}
