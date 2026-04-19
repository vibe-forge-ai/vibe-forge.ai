import { relative } from 'node:path'

import { isAlwaysRule, resolveDefinitionName, resolveDocumentDescription } from '@vibe-forge/definition-core'
import type { Definition, Entity, Rule, Spec, WorkspaceDefinitionPayload } from '@vibe-forge/types'

const toRelativePath = (absolutePath: string, cwd: string) => {
  const rel = relative(cwd, absolutePath)
  return rel.startsWith('..') ? absolutePath : rel
}

const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') return [value]
  return []
}

const toIncludeList = (value: unknown, key: 'include' | 'list'): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (value && typeof value === 'object') {
    const items = (value as Record<typeof key, unknown>)[key]
    if (Array.isArray(items)) {
      return items.filter((item): item is string => typeof item === 'string')
    }
  }

  return []
}

const toRuleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item == null || typeof item !== 'object') return []

    const desc = typeof (item as { desc?: unknown }).desc === 'string'
      ? (item as { desc: string }).desc
      : undefined

    if ((item as { type?: unknown }).type === 'remote') {
      const tags = toStringList((item as { tags?: unknown }).tags)
      return [desc ?? (tags.length > 0 ? `remote:${tags.join(',')}` : 'remote')]
    }

    const path = typeof (item as { path?: unknown }).path === 'string'
      ? (item as { path: string }).path
      : undefined

    return [desc ?? path].filter((rule): rule is string => Boolean(rule))
  })
}

const resolveSpecSummary = (spec: Definition<Spec>) => {
  const name = resolveDefinitionName(spec, ['index.md'])
  return {
    name,
    description: resolveDocumentDescription(spec.body, spec.attributes.description, name)
  }
}

const resolveEntitySummary = (entity: Definition<Entity>) => {
  const name = resolveDefinitionName(entity, ['readme.md', 'index.json'])
  return {
    name,
    description: resolveDocumentDescription(entity.body, entity.attributes.description, name)
  }
}

const resolveRuleSummary = (rule: Definition<Rule>) => {
  const name = resolveDefinitionName(rule)
  return {
    name,
    description: resolveDocumentDescription(rule.body, rule.attributes.description, name)
  }
}

export const matchesDefinitionPath = (
  definition: Pick<Definition<object>, 'path'>,
  targetPath: string,
  cwd: string
) => {
  const relativePath = toRelativePath(definition.path, cwd)
  return relativePath === targetPath || definition.path === targetPath
}

export const presentSpec = (spec: Definition<Spec>, cwd: string) => {
  const { name, description } = resolveSpecSummary(spec)
  return {
    id: toRelativePath(spec.path, cwd),
    name,
    description,
    params: spec.attributes.params ?? [],
    always: spec.attributes.always ?? true,
    tags: toIncludeList(spec.attributes.tags, 'include'),
    skills: toIncludeList(spec.attributes.skills, 'include'),
    rules: toIncludeList(spec.attributes.rules, 'include')
  }
}

export const presentSpecDetail = (spec: Definition<Spec>, cwd: string) => ({
  ...presentSpec(spec, cwd),
  body: spec.body ?? ''
})

export const presentEntity = (entity: Definition<Entity>, cwd: string) => {
  const { name, description } = resolveEntitySummary(entity)
  return {
    id: toRelativePath(entity.path, cwd),
    name,
    description,
    always: entity.attributes.always ?? true,
    tags: toIncludeList(entity.attributes.tags, 'include'),
    skills: toIncludeList(entity.attributes.skills, 'list'),
    rules: toRuleList(entity.attributes.rules)
  }
}

export const presentEntityDetail = (entity: Definition<Entity>, cwd: string) => ({
  ...presentEntity(entity, cwd),
  body: entity.body ?? ''
})

export const presentRule = (rule: Definition<Rule>, cwd: string) => {
  const { name, description } = resolveRuleSummary(rule)
  return {
    id: toRelativePath(rule.path, cwd),
    name,
    description,
    always: isAlwaysRule(rule.attributes),
    globs: toStringList(
      (rule.attributes as { globs?: unknown; glob?: unknown }).globs ??
        (rule.attributes as { globs?: unknown; glob?: unknown }).glob
    )
  }
}

export const presentRuleDetail = (rule: Definition<Rule>, cwd: string) => ({
  ...presentRule(rule, cwd),
  body: rule.body ?? ''
})

export const presentWorkspace = (workspace: WorkspaceDefinitionPayload) => ({
  id: workspace.id,
  name: workspace.name ?? workspace.id,
  description: workspace.description ?? '',
  path: workspace.path,
  cwd: workspace.cwd,
  pattern: workspace.pattern
})
