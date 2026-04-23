import { CONFIG_SECTION_KEYS } from './sections'
import type { ConfigSectionKey } from './sections'

export type ConfigPathSegment = string | number

export interface ResolvedConfigSectionPath {
  input: ConfigPathSegment[]
  normalizedPath: string
  section: ConfigSectionKey
  sectionPath: ConfigPathSegment[]
}

const GENERAL_FIELD_KEYS = new Set([
  'baseDir',
  'effort',
  'defaultAdapter',
  'defaultModelService',
  'defaultModel',
  'recommendedModels',
  'interfaceLanguage',
  'modelLanguage',
  'announcements',
  'permissions',
  'env',
  'notifications',
  'skills',
  'shortcuts'
])

const SECTION_KEY_SET = new Set<string>(CONFIG_SECTION_KEYS)

interface RootPathAlias {
  section: ConfigSectionKey
  prefix: readonly ConfigPathSegment[]
}

const ROOT_PATH_ALIAS_ENTRIES: Array<[string, RootPathAlias]> = [
  ...Array.from(GENERAL_FIELD_KEYS, (key): [string, RootPathAlias] => [
    key,
    {
      section: 'general',
      prefix: [key]
    }
  ]),
  [
    'mcpServers',
    {
      section: 'mcp' as const,
      prefix: ['mcpServers']
    }
  ],
  [
    'defaultIncludeMcpServers',
    {
      section: 'mcp' as const,
      prefix: ['defaultIncludeMcpServers']
    }
  ],
  [
    'defaultExcludeMcpServers',
    {
      section: 'mcp' as const,
      prefix: ['defaultExcludeMcpServers']
    }
  ],
  [
    'noDefaultVibeForgeMcpServer',
    {
      section: 'mcp' as const,
      prefix: ['noDefaultVibeForgeMcpServer']
    }
  ],
  [
    'marketplaces',
    {
      section: 'plugins' as const,
      prefix: ['marketplaces']
    }
  ]
]

const ROOT_PATH_ALIASES = new Map<string, RootPathAlias>(ROOT_PATH_ALIAS_ENTRIES)

const normalizePathSegment = (value: unknown): ConfigPathSegment => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value !== 'string') {
    throw new TypeError('Config path segments must be strings or non-negative integers.')
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    throw new TypeError('Config path segments must not be empty.')
  }

  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : trimmed
}

const formatPathSegment = (value: ConfigPathSegment) => String(value)

export const parseConfigSectionPath = (value: string): ConfigPathSegment[] => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return []
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) {
      throw new TypeError('JSON config path must be an array of path segments.')
    }
    return parsed.map(segment => normalizePathSegment(segment))
  }

  return trimmed
    .split('.')
    .filter(segment => segment.trim() !== '')
    .map(segment => normalizePathSegment(segment))
}

export const resolveConfigSectionPath = (
  path: readonly ConfigPathSegment[]
): ResolvedConfigSectionPath => {
  if (path.length === 0) {
    throw new TypeError('Config path must not be empty.')
  }

  const [firstSegment, ...restSegments] = path
  if (typeof firstSegment !== 'string') {
    throw new TypeError('Config path must start with a section name or root config key.')
  }

  if (firstSegment === 'plugins') {
    if (restSegments.length === 0) {
      return {
        input: Array.from(path),
        normalizedPath: 'plugins',
        section: 'plugins',
        sectionPath: []
      }
    }

    const [secondSegment] = restSegments
    const pluginSectionPath = (secondSegment === 'plugins' || secondSegment === 'marketplaces')
      ? restSegments
      : ['plugins', ...restSegments]

    return {
      input: Array.from(path),
      normalizedPath: ['plugins', ...pluginSectionPath].map(segment => formatPathSegment(segment)).join('.'),
      section: 'plugins',
      sectionPath: pluginSectionPath
    }
  }

  if (SECTION_KEY_SET.has(firstSegment)) {
    return {
      input: Array.from(path),
      normalizedPath: path.map(segment => formatPathSegment(segment)).join('.'),
      section: firstSegment as ConfigSectionKey,
      sectionPath: restSegments
    }
  }

  const alias = ROOT_PATH_ALIASES.get(firstSegment)
  if (alias == null) {
    throw new TypeError(`Unknown config path root "${firstSegment}".`)
  }

  const sectionPath = [
    ...alias.prefix,
    ...restSegments
  ]

  return {
    input: Array.from(path),
    normalizedPath: [alias.section, ...sectionPath].map(segment => formatPathSegment(segment)).join('.'),
    section: alias.section,
    sectionPath
  }
}
