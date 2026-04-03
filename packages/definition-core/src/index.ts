import { basename, dirname } from 'node:path'

import type { Definition, LocalRuleReference, RemoteRuleReference, Rule, RuleReference } from '@vibe-forge/types'

const stripExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '')

const hasAnySuffix = (value: string, suffixes: string[]) => suffixes.some(suffix => value.endsWith(suffix))

export const parseScopedReference = (
  value: string,
  options: {
    pathSuffixes?: string[]
  } = {}
) => {
  const pathSuffixes = options.pathSuffixes ?? ['.md', '.json']

  if (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    hasAnySuffix(value, pathSuffixes)
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

export const isPathLikeReference = (
  value: string,
  options: {
    pathSuffixes?: string[]
    allowGlob?: boolean
  } = {}
) => {
  const pathSuffixes = options.pathSuffixes ?? ['.md', '.json']
  const allowGlob = options.allowGlob ?? false

  return (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    (allowGlob && value.includes('*')) ||
    hasAnySuffix(value, pathSuffixes)
  )
}

export const resolveDocumentName = (
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

  return stripExtension(basename(path))
}

export const resolveSpecIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['index.md'])
)

export const resolveEntityIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['readme.md', 'index.json'])
)

export const resolveSkillIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['skill.md'])
)

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

export const resolveDefinitionName = <T extends { name?: string }>(
  definition: Definition<T>,
  indexFileNames: string[] = []
) => definition.resolvedName?.trim() || resolveDocumentName(definition.path, definition.attributes.name, indexFileNames)

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

export const createRemoteRuleDefinition = (
  rule: RemoteRuleReference,
  index: number
): Definition<Rule> => {
  const tags = toNonEmptyStringArray(rule.tags)
  const description = rule.desc?.trim() || (
    tags.length > 0
      ? `Remote knowledge base tags: ${tags.join(', ')}`
      : 'Remote knowledge base rule reference'
  )
  const bodyParts = [
    description,
    tags.length > 0 ? `Knowledge base tags: ${tags.join(', ')}` : undefined,
    'This rule comes from a remote knowledge base reference and does not correspond to a local file.'
  ].filter((value): value is string => Boolean(value))

  return {
    path: `remote-rule-${index + 1}.md`,
    body: bodyParts.join('\n'),
    attributes: {
      name: tags.length > 0 ? `remote:${tags.join(',')}` : `remote-rule-${index + 1}`,
      description
    }
  }
}
