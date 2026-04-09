import type { ClaudeCodeMarketplacePluginDefinition, ClaudeCodeMarketplacePluginSource } from '@vibe-forge/types'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const normalizeOptionalStringList = (value: unknown) => (
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
    ? value
      .map(item => normalizeNonEmptyString(item))
      .filter((item): item is string => item != null)
    : undefined
)

export interface NormalizeMarketplacePluginDefinitionOptions {
  allowPathStringSource?: boolean
}

const normalizeMarketplacePluginSource = (
  value: unknown,
  path: string,
  options: NormalizeMarketplacePluginDefinitionOptions = {}
): ClaudeCodeMarketplacePluginSource => {
  if (typeof value === 'string' && value.trim() !== '') {
    if (options.allowPathStringSource !== true) {
      throw new TypeError(
        `Invalid marketplace plugin source at ${path}. Inline Claude settings marketplaces must use an explicit source object because config-backed marketplaces cannot resolve relative plugin paths.`
      )
    }
    return value.trim()
  }
  if (!isRecord(value) || typeof value.source !== 'string') {
    throw new TypeError(`Invalid marketplace plugin source at ${path}.`)
  }

  switch (value.source) {
    case 'github': {
      const repo = normalizeNonEmptyString(value.repo)
      if (repo == null) {
        throw new TypeError(`Invalid marketplace plugin source at ${path}. "repo" must be a non-empty string.`)
      }
      return {
        source: 'github',
        repo,
        ...(normalizeNonEmptyString(value.ref) != null ? { ref: normalizeNonEmptyString(value.ref) } : {}),
        ...(normalizeNonEmptyString(value.sha) != null ? { sha: normalizeNonEmptyString(value.sha) } : {})
      }
    }
    case 'url': {
      const url = normalizeNonEmptyString(value.url)
      if (url == null) {
        throw new TypeError(`Invalid marketplace plugin source at ${path}. "url" must be a non-empty string.`)
      }
      return {
        source: 'url',
        url,
        ...(normalizeNonEmptyString(value.ref) != null ? { ref: normalizeNonEmptyString(value.ref) } : {}),
        ...(normalizeNonEmptyString(value.sha) != null ? { sha: normalizeNonEmptyString(value.sha) } : {})
      }
    }
    case 'git-subdir': {
      const url = normalizeNonEmptyString(value.url)
      const subdirPath = normalizeNonEmptyString(value.path)
      if (url == null || subdirPath == null) {
        throw new TypeError(
          `Invalid marketplace plugin source at ${path}. "url" and "path" must be non-empty strings.`
        )
      }
      return {
        source: 'git-subdir',
        url,
        path: subdirPath,
        ...(normalizeNonEmptyString(value.ref) != null ? { ref: normalizeNonEmptyString(value.ref) } : {}),
        ...(normalizeNonEmptyString(value.sha) != null ? { sha: normalizeNonEmptyString(value.sha) } : {})
      }
    }
    case 'npm': {
      const packageName = normalizeNonEmptyString(value.package)
      if (packageName == null) {
        throw new TypeError(`Invalid marketplace plugin source at ${path}. "package" must be a non-empty string.`)
      }
      return {
        source: 'npm',
        package: packageName,
        ...(normalizeNonEmptyString(value.version) != null ? { version: normalizeNonEmptyString(value.version) } : {}),
        ...(normalizeNonEmptyString(value.registry) != null
          ? { registry: normalizeNonEmptyString(value.registry) }
          : {})
      }
    }
    default:
      throw new TypeError(`Unsupported marketplace plugin source "${String(value.source)}" at ${path}.`)
  }
}

export const normalizeMarketplacePluginDefinition = (
  value: unknown,
  path: string,
  options: NormalizeMarketplacePluginDefinitionOptions = {}
): ClaudeCodeMarketplacePluginDefinition => {
  if (!isRecord(value)) {
    throw new TypeError(`Invalid marketplace plugin definition at ${path}. Expected an object.`)
  }

  const name = normalizeNonEmptyString(value.name)
  if (name == null) {
    throw new TypeError(`Invalid marketplace plugin definition at ${path}. "name" must be a non-empty string.`)
  }

  return {
    name,
    source: normalizeMarketplacePluginSource(value.source, `${path}.source`, options),
    ...(normalizeNonEmptyString(value.description) != null
      ? { description: normalizeNonEmptyString(value.description) }
      : {}),
    ...(normalizeNonEmptyString(value.version) != null ? { version: normalizeNonEmptyString(value.version) } : {}),
    ...(typeof value.strict === 'boolean' ? { strict: value.strict } : {}),
    ...(normalizeOptionalStringList(value.skills) != null ? { skills: normalizeOptionalStringList(value.skills) } : {}),
    ...(normalizeOptionalStringList(value.commands) != null
      ? { commands: normalizeOptionalStringList(value.commands) }
      : {}),
    ...(normalizeOptionalStringList(value.agents) != null ? { agents: normalizeOptionalStringList(value.agents) } : {}),
    ...(typeof value.hooks === 'string' || Array.isArray(value.hooks) || isRecord(value.hooks)
      ? { hooks: value.hooks as ClaudeCodeMarketplacePluginDefinition['hooks'] }
      : {}),
    ...(typeof value.mcpServers === 'string' || Array.isArray(value.mcpServers) || isRecord(value.mcpServers)
      ? { mcpServers: value.mcpServers as ClaudeCodeMarketplacePluginDefinition['mcpServers'] }
      : {}),
    ...('userConfig' in value ? { userConfig: value.userConfig } : {})
  }
}
