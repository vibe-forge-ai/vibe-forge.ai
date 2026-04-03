import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { Definition, LocalRuleReference, RemoteRuleReference, Rule, RuleReference } from '@vibe-forge/types'
import { normalizePath, resolveDocumentName } from '@vibe-forge/utils'
import fm from 'front-matter'

export const loadLocalDocuments = async <Attrs extends object>(
  paths: string[]
): Promise<Definition<Attrs>[]> => {
  const promises = paths.map(async (path) => {
    const content = await readFile(path, 'utf-8')
    const { body, attributes } = fm<Attrs>(content)
    return {
      path,
      body,
      attributes
    }
  })
  return Promise.all(promises)
}

const getFirstNonEmptyLine = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

export const resolveDocumentDescription = (
  body: string,
  explicitDescription?: string,
  fallbackName?: string
) => {
  const trimmedDescription = explicitDescription?.trim()
  return trimmedDescription || getFirstNonEmptyLine(body) || fallbackName || ''
}

export const isAlwaysRule = (attributes: Pick<Rule, 'always' | 'alwaysApply'>) => (
  attributes.always ?? attributes.alwaysApply ?? false
)

export const resolveEntityIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['readme.md', 'index.json'])
)

export const resolveDefinitionName = <T extends { name?: string }>(
  definition: Definition<T>,
  indexFileNames: string[] = []
) => definition.resolvedName?.trim() || resolveDocumentName(definition.path, definition.attributes.name, indexFileNames)

const parseScopedReference = (value: string) => {
  if (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    value.endsWith('.md') ||
    value.endsWith('.json')
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

export const resolveUniqueDefinition = <TDefinition extends { name?: string }>(
  definitions: Definition<TDefinition>[],
  ref: string,
  resolveIdentifier: (definition: Definition<TDefinition>) => string
) => {
  const scoped = parseScopedReference(ref)
  if (scoped != null) {
    return definitions.find(definition => definition.resolvedName === ref)
  }

  const matches = definitions.filter(definition => resolveIdentifier(definition) === ref)
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous asset reference ${ref}. Candidates: ${
        matches.map(item => item.resolvedName ?? resolveIdentifier(item)).join(', ')
      }`
    )
  }
  return matches[0]
}

const toNonEmptyStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) return []

  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
}

export const isLocalRuleReference = (value: RuleReference): value is LocalRuleReference => {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { path?: unknown }).path === 'string' &&
    ((value as { type?: unknown }).type == null || (value as { type?: unknown }).type === 'local')
  )
}

export const isRemoteRuleReference = (value: RuleReference): value is RemoteRuleReference => {
  return (
    value != null &&
    typeof value === 'object' &&
    value.type === 'remote'
  )
}

export const resolveRulePattern = (pattern: string, baseDir: string) => {
  const trimmed = pattern.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return normalizePath(resolve(baseDir, trimmed))
  }

  return trimmed
}

export const createRemoteRuleDefinition = (
  rule: RemoteRuleReference,
  index: number
): Definition<Rule> => {
  const tags = toNonEmptyStringArray(rule.tags)
  const desc = rule.desc?.trim() || (
    tags.length > 0
      ? `远程知识库标签：${tags.join(', ')}`
      : '远程知识库规则引用'
  )
  const bodyParts = [
    desc,
    tags.length > 0 ? `知识库标签：${tags.join(', ')}` : undefined,
    '该规则来自远程知识库引用，不对应本地文件。'
  ].filter((value): value is string => Boolean(value))

  return {
    path: `remote-rule-${index + 1}.md`,
    body: bodyParts.join('\n'),
    attributes: {
      name: tags.length > 0 ? `remote:${tags.join(',')}` : `remote-rule-${index + 1}`,
      description: desc
    }
  }
}
