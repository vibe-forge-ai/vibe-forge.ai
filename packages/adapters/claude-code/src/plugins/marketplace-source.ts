import path from 'node:path'

import type {
  ClaudeCodeMarketplacePluginDefinition,
  ClaudeCodeMarketplacePluginSource,
  ManagedPluginSource
} from '@vibe-forge/types'

import type { ClaudeMarketplaceCatalog } from './marketplace-catalog'
import type { ClaudePluginManifest } from './source'

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const resolvePathWithinRoot = (rootDir: string, candidatePath: string, description: string) => {
  const resolvedPath = path.resolve(rootDir, candidatePath)
  const relativePath = path.relative(rootDir, resolvedPath)
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${description} resolves outside the marketplace root.`)
  }
  return resolvedPath
}

export const resolveMarketplacePluginSource = (params: {
  source: ClaudeCodeMarketplacePluginSource
  catalog: ClaudeMarketplaceCatalog
  rootDir?: string
  marketplaceName: string
  pluginName: string
}): ManagedPluginSource => {
  if (typeof params.source === 'string') {
    if (params.rootDir == null) {
      throw new Error(
        `Claude marketplace plugin ${params.pluginName}@${params.marketplaceName} uses a relative source, but its marketplace is not directory-backed.`
      )
    }

    const pluginRootPrefix = normalizeNonEmptyString(params.catalog.metadata?.pluginRoot)
    const relativeSource = pluginRootPrefix != null &&
        !params.source.startsWith('./') &&
        !params.source.startsWith('../')
      ? path.join(pluginRootPrefix, params.source)
      : params.source

    return {
      type: 'path',
      path: resolvePathWithinRoot(
        params.rootDir,
        relativeSource,
        `Marketplace plugin source for ${params.pluginName}@${params.marketplaceName}`
      )
    }
  }

  switch (params.source.source) {
    case 'github':
      return {
        type: 'github',
        repo: params.source.repo,
        ...(params.source.ref != null ? { ref: params.source.ref } : {}),
        ...(params.source.sha != null ? { sha: params.source.sha } : {})
      }
    case 'url':
      return {
        type: 'git',
        url: params.source.url,
        ...(params.source.ref != null ? { ref: params.source.ref } : {}),
        ...(params.source.sha != null ? { sha: params.source.sha } : {})
      }
    case 'git-subdir':
      return {
        type: 'git-subdir',
        url: params.source.url,
        path: params.source.path,
        ...(params.source.ref != null ? { ref: params.source.ref } : {}),
        ...(params.source.sha != null ? { sha: params.source.sha } : {})
      }
    case 'npm':
      return {
        type: 'npm',
        spec: params.source.version != null
          ? `${params.source.package}@${params.source.version}`
          : params.source.package,
        ...(params.source.registry != null ? { registry: params.source.registry } : {})
      }
  }
}

export const toMarketplaceManifestOverrides = (
  plugin: ClaudeCodeMarketplacePluginDefinition
): Partial<ClaudePluginManifest> => ({
  name: plugin.name,
  ...(plugin.description != null ? { description: plugin.description } : {}),
  ...(plugin.version != null ? { version: plugin.version } : {}),
  ...(plugin.strict != null ? { strict: plugin.strict } : {}),
  ...(plugin.skills != null ? { skills: plugin.skills } : {}),
  ...(plugin.commands != null ? { commands: plugin.commands } : {}),
  ...(plugin.agents != null ? { agents: plugin.agents } : {}),
  ...(plugin.hooks != null ? { hooks: plugin.hooks } : {}),
  ...(plugin.mcpServers != null ? { mcpServers: plugin.mcpServers } : {}),
  ...('userConfig' in plugin ? { userConfig: plugin.userConfig } : {})
})
